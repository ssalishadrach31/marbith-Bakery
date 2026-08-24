import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import {
  cockroachDb as db,
  neonDb,
  productionTable,
  productsTable,
  salesTable,
  saleItemsTable,
  inventoryTable,
  shopReceiptsTable,
  expensesTable,
  dailyCountsTable,
  attendanceTable,
  employeesTable,
} from "@workspace/db";
import { eq, sql, and, inArray, desc } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
const DASHBOARD_CACHE_MS = 15_000;
const dashboardCache = new Map<string, { expiresAt: number; value: any }>();
const dashboardRequests = new Map<string, Promise<any>>();

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

router.get("/staff-dashboard", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(`${today}T12:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = tomorrow.toISOString();
  const cacheKey = today;
  const getSelfAttendance = () => neonDb.select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.name}) = LOWER(${user.name})`)
    .then(async ([emp]) => {
      if (!emp) return null;
      const records = await db.select().from(attendanceTable)
        .where(eq(attendanceTable.employeeId, emp.id))
        .orderBy(desc(attendanceTable.checkIn))
        .limit(1);
      const todayRecord = records.find((record) => record.date === today) ?? null;
      if (!todayRecord) return null;
      return {
        ...todayRecord,
        employeeName: emp.name,
        checkIn: todayRecord.checkIn.toISOString(),
        checkOut: todayRecord.checkOut?.toISOString() ?? null,
      };
    }).catch(() => null);
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ ...cached.value, selfAttendance: await getSelfAttendance() });
    return;
  }
  const pending = dashboardRequests.get(cacheKey);
  if (pending) {
    res.json({ ...(await pending), selfAttendance: await getSelfAttendance() });
    return;
  }

  const dashboardRequest = (async () => {
    // ── Run ALL queries in parallel ──────────────────────────────────────────
    const queryResults = await Promise.allSettled([
    // 1. Today's production entries
    db.select({
      id: productionTable.id,
      productName: productsTable.name,
      productId: productionTable.productId,
      quantity: productionTable.quantity,
      recordedBy: productionTable.recordedBy,
      producedAt: productionTable.producedAt,
      notes: productionTable.notes,
    })
    .from(productionTable)
    .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
    .where(sql`${productionTable.producedAt} >= ${dayStart}::timestamptz AND ${productionTable.producedAt} < ${dayEnd}::timestamptz`)
    .orderBy(productionTable.producedAt),

    // 2. Production summary per product today
    db.select({
      productId: productionTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      totalProduced: sql<number>`SUM(${productionTable.quantity})::int`,
    })
    .from(productionTable)
    .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
    .where(sql`${productionTable.producedAt} >= ${dayStart}::timestamptz AND ${productionTable.producedAt} < ${dayEnd}::timestamptz`)
    .groupBy(productionTable.productId, productsTable.name, productsTable.price),

    // 3. Shop receipts today
    db.select({
      id: shopReceiptsTable.id,
      productId: shopReceiptsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      quantityReceived: shopReceiptsTable.quantityReceived,
      receivedBy: shopReceiptsTable.receivedBy,
      receivedAt: shopReceiptsTable.receivedAt,
      notes: shopReceiptsTable.notes,
    })
    .from(shopReceiptsTable)
    .leftJoin(productsTable, eq(shopReceiptsTable.productId, productsTable.id))
    .where(sql`${shopReceiptsTable.receivedAt} >= ${dayStart}::timestamptz AND ${shopReceiptsTable.receivedAt} < ${dayEnd}::timestamptz`)
    .orderBy(shopReceiptsTable.receivedAt),

    // 4. Shop receipts summary per product today
    db.select({
      productId: shopReceiptsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      totalReceived: sql<number>`SUM(${shopReceiptsTable.quantityReceived})::int`,
    })
    .from(shopReceiptsTable)
    .leftJoin(productsTable, eq(shopReceiptsTable.productId, productsTable.id))
    .where(sql`${shopReceiptsTable.receivedAt} >= ${dayStart}::timestamptz AND ${shopReceiptsTable.receivedAt} < ${dayEnd}::timestamptz`)
    .groupBy(shopReceiptsTable.productId, productsTable.name, productsTable.price),

    // 5. Today's sales transactions
    db.select({
      id: salesTable.id,
      receiptNumber: salesTable.receiptNumber,
      totalAmount: salesTable.totalAmount,
      paymentMethod: salesTable.paymentMethod,
      soldBy: salesTable.soldBy,
      soldAt: salesTable.soldAt,
      itemCount: sql<number>`COUNT(${saleItemsTable.id})::int`,
    })
    .from(salesTable)
    .leftJoin(saleItemsTable, eq(salesTable.id, saleItemsTable.saleId))
    .where(sql`${salesTable.soldAt} >= ${dayStart}::timestamptz AND ${salesTable.soldAt} < ${dayEnd}::timestamptz`)
    .groupBy(salesTable.id)
    .orderBy(salesTable.soldAt),

    // 6. Sales by person today
    db.select({
      soldBy: salesTable.soldBy,
      transactions: sql<number>`COUNT(*)::int`,
      totalAmount: sql<number>`SUM(${salesTable.totalAmount})`,
    })
    .from(salesTable)
    .where(sql`${salesTable.soldAt} >= ${dayStart}::timestamptz AND ${salesTable.soldAt} < ${dayEnd}::timestamptz`)
    .groupBy(salesTable.soldBy)
    .orderBy(sql`SUM(${salesTable.totalAmount}) DESC`),

    // 7. Sales by product today
    db.select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      qtySold: sql<number>`SUM(${saleItemsTable.quantity})::int`,
      revenue: sql<number>`SUM(${saleItemsTable.subtotal})`,
    })
    .from(saleItemsTable)
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(sql`${salesTable.soldAt} >= ${dayStart}::timestamptz AND ${salesTable.soldAt} < ${dayEnd}::timestamptz`)
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`SUM(${saleItemsTable.subtotal}) DESC`),

    // 8. Current inventory
    db.select({
      productId: inventoryTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      currentStock: inventoryTable.currentStock,
    })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .orderBy(productsTable.name),

    // 9. Today's approved expenses
    db.select({ total: sql<number>`COALESCE(SUM(${expensesTable.amount}), 0)::int` })
      .from(expensesTable)
      .where(and(eq(expensesTable.expenseDate, today), eq(expensesTable.status, "approved"))),

    // 10. Today's pending expenses grouped by submitter
    db.select({
      submittedBy: expensesTable.submittedBy,
      total: sql<number>`SUM(${expensesTable.amount})::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.expenseDate, today), inArray(expensesTable.status, ["pending", "awaiting_second"])))
    .groupBy(expensesTable.submittedBy),

    // 11. Today's daily counts (ice cream, juice, coffee, tea)
    db.select({
      id: dailyCountsTable.id,
      productId: dailyCountsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      category: productsTable.category,
      countType: dailyCountsTable.countType,
      quantity: dailyCountsTable.quantity,
      countDate: dailyCountsTable.countDate,
      recordedBy: dailyCountsTable.recordedBy,
      recordedAt: dailyCountsTable.recordedAt,
      notes: dailyCountsTable.notes,
    })
    .from(dailyCountsTable)
    .leftJoin(productsTable, eq(dailyCountsTable.productId, productsTable.id))
    .where(eq(dailyCountsTable.countDate, today))
    .orderBy(productsTable.category, productsTable.name, dailyCountsTable.countType),

    // 12. All active products (for POS / production dropdowns)
    neonDb.select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      category: productsTable.category,
      unit: productsTable.unit,
      lowStockThreshold: productsTable.lowStockThreshold,
      isActive: productsTable.isActive,
    })
    .from(productsTable)
    .where(eq(productsTable.isActive, true))
    .orderBy(productsTable.name),

    // 13. Recent shift closings (last 60)
    db.execute(sql`
      SELECT id, closed_by, shift_date::text AS shift_date, closed_at, notes, status, approved_by, approved_at
      FROM shift_closings ORDER BY shift_date DESC LIMIT 60
    `).then((r) => r.rows.map((row: any) => ({
      id: row.id,
      closedBy: row.closed_by,
      shiftDate: row.shift_date,
      closedAt: row.closed_at,
      notes: row.notes,
      status: row.status ?? "approved",
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approved_at ?? null,
    }))).catch(() => [] as any[]),

    // 14. Today's new-day request
    db.execute(sql`
      SELECT id, requested_by, requested_by_id,
             for_date::text AS for_date, from_date::text AS from_date,
             requested_at, status, approved_by, approved_at
      FROM new_day_requests WHERE for_date = ${today}::date
      ORDER BY requested_at DESC LIMIT 1
    `).then((r) => r.rows[0] ?? null).catch(() => null),

  ]);
    const queryValues = queryResults.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`staff-dashboard query ${index + 1} failed:`, result.reason);
      return index === 13 ? null : [];
    });
    const [
      productionEntries,
      productionByProduct,
      receiptEntries,
      receiptsByProduct,
      salesTransactions,
      salesByPerson,
      salesByProduct,
      inventory,
      approvedExpensesRows,
      pendingExpensesRows,
      todayDailyCounts,
      allProducts,
      shiftClosingsRows,
      newDayRequestRow,
    ] = queryValues as any[];

  // ── Summaries ──────────────────────────────────────────────────────────────
  const approvedExpensesTotal = approvedExpensesRows[0]?.total ?? 0;
  const totalRevenue = salesTransactions.reduce((s, t) => s + (t.totalAmount ?? 0), 0);
  const totalReceived = receiptsByProduct.reduce((s, r) => s + (r.totalReceived ?? 0), 0);
  const totalProduced = productionByProduct.reduce((s, p) => s + (p.totalProduced ?? 0), 0);
  const totalSoldUnits = (salesByProduct as any[]).reduce((s, p) => s + (p.qtySold ?? 0), 0);
  const remainingStock = inventory.reduce((s, i) => s + (i.currentStock ?? 0), 0);

  const cashierAccounts = salesByPerson.map((person) => {
    const theirReceipts = receiptEntries
      .filter((r) => r.receivedBy === person.soldBy)
      .reduce((s, r) => s + (r.quantityReceived ?? 0), 0);
    return {
      name: person.soldBy,
      transactions: person.transactions ?? 0,
      totalSales: person.totalAmount ?? 0,
      unitsReceivedFromBakery: theirReceipts,
    };
  });
  const salesNames = new Set(salesByPerson.map((p) => p.soldBy));
  const receiversOnly = [...new Set(receiptEntries.map((r) => r.receivedBy))]
    .filter((name) => !salesNames.has(name))
    .map((name) => ({
      name,
      transactions: 0,
      totalSales: 0,
      unitsReceivedFromBakery: receiptEntries
        .filter((r) => r.receivedBy === name)
        .reduce((s, r) => s + (r.quantityReceived ?? 0), 0),
    }));

    const response = {
    date: today,
    production: {
      entries: productionEntries.map((e) => ({ ...e, productName: e.productName ?? "Unknown" })),
      byProduct: productionByProduct.map((p) => ({ ...p, productName: p.productName ?? "Unknown", totalProduced: p.totalProduced ?? 0 })),
      totalUnits: totalProduced,
    },
    receipts: {
      entries: receiptEntries.map((r) => ({ ...r, productName: r.productName ?? "Unknown" })),
      byProduct: receiptsByProduct.map((r) => ({ ...r, productName: r.productName ?? "Unknown", totalReceived: r.totalReceived ?? 0 })),
      totalReceived,
    },
    sales: {
      transactions: salesTransactions.map((t) => ({ ...t, itemCount: t.itemCount ?? 0 })),
      byPerson: salesByPerson.map((p) => ({ soldBy: p.soldBy, transactions: p.transactions ?? 0, totalAmount: p.totalAmount ?? 0 })),
      byProduct: (salesByProduct as any[]).map((p) => ({ ...p, productName: p.productName ?? "Unknown", qtySold: p.qtySold ?? 0, revenue: p.revenue ?? 0 })),
      totalRevenue,
      totalSoldUnits,
      transactionCount: salesTransactions.length,
    },
    inventory: inventory.map((i) => ({
      ...i,
      productName: i.productName ?? "Unknown",
      stockValue: (i.currentStock ?? 0) * (i.price ?? 0),
    })),
    accountability: {
      cashiers: [...cashierAccounts, ...receiversOnly],
      combinedRevenue: totalRevenue,
      totalProduced,
      totalReceived,
      totalSoldUnits,
      remainingStock,
    },
    expenses: {
      approvedTotal: approvedExpensesTotal,
      pendingByPerson: pendingExpensesRows.map((r) => ({
        submittedBy: r.submittedBy,
        total: r.total ?? 0,
        count: r.count ?? 0,
      })),
    },
    // Bundled data — eliminates extra round trips from the frontend
    dailyCounts: todayDailyCounts.map((r) => ({ ...r, productName: r.productName ?? "Unknown", price: r.price ?? 0 })),
    products: allProducts,
    shiftClosings: shiftClosingsRows,
    newDayRequest: newDayRequestRow,
    selfAttendance: null,
    };
    dashboardCache.set(cacheKey, { expiresAt: Date.now() + DASHBOARD_CACHE_MS, value: response });
    return response;
  })();

  dashboardRequests.set(cacheKey, dashboardRequest);
  try {
    const response = await dashboardRequest;
    res.json({ ...response, selfAttendance: await getSelfAttendance() });
  } finally {
    dashboardRequests.delete(cacheKey);
  }
});

export default router;
