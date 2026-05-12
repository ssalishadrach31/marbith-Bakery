import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, productionTable, productsTable, salesTable, saleItemsTable, inventoryTable, shopReceiptsTable, expensesTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

router.get("/staff-dashboard", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];

  // 1. Today's production entries (detailed log)
  const productionEntries = await db
    .select({
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
    .where(sql`DATE(${productionTable.producedAt}) = ${today}`)
    .orderBy(productionTable.producedAt);

  // 2. Production summary per product today
  const productionByProduct = await db
    .select({
      productId: productionTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      totalProduced: sql<number>`SUM(${productionTable.quantity})::int`,
    })
    .from(productionTable)
    .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
    .where(sql`DATE(${productionTable.producedAt}) = ${today}`)
    .groupBy(productionTable.productId, productsTable.name, productsTable.price);

  // 3. Shop receipts today (what cashier confirmed receiving)
  const receiptEntries = await db
    .select({
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
    .where(sql`DATE(${shopReceiptsTable.receivedAt}) = ${today}`)
    .orderBy(shopReceiptsTable.receivedAt);

  // 4. Shop receipts summary per product today
  const receiptsByProduct = await db
    .select({
      productId: shopReceiptsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      totalReceived: sql<number>`SUM(${shopReceiptsTable.quantityReceived})::int`,
    })
    .from(shopReceiptsTable)
    .leftJoin(productsTable, eq(shopReceiptsTable.productId, productsTable.id))
    .where(sql`DATE(${shopReceiptsTable.receivedAt}) = ${today}`)
    .groupBy(shopReceiptsTable.productId, productsTable.name, productsTable.price);

  // 5. Today's sales transactions
  const salesTransactions = await db
    .select({
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
    .where(sql`DATE(${salesTable.soldAt}) = ${today}`)
    .groupBy(salesTable.id)
    .orderBy(salesTable.soldAt);

  // 6. Sales by person today
  const salesByPerson = await db
    .select({
      soldBy: salesTable.soldBy,
      transactions: sql<number>`COUNT(*)::int`,
      totalAmount: sql<number>`SUM(${salesTable.totalAmount})`,
    })
    .from(salesTable)
    .where(sql`DATE(${salesTable.soldAt}) = ${today}`)
    .groupBy(salesTable.soldBy)
    .orderBy(sql`SUM(${salesTable.totalAmount}) DESC`);

  // 7. Sales by product today
  const salesByProduct = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      qtySold: sql<number>`SUM(${saleItemsTable.quantity})::int`,
      revenue: sql<number>`SUM(${saleItemsTable.subtotal})`,
    })
    .from(saleItemsTable)
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(sql`DATE(${salesTable.soldAt}) = ${today}`)
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`SUM(${saleItemsTable.subtotal}) DESC`);

  // 8. Current inventory
  const inventory = await db
    .select({
      productId: inventoryTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      currentStock: inventoryTable.currentStock,
    })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .orderBy(productsTable.name);

  // 9. Today's approved expenses (deducted from grand total)
  const approvedExpensesRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${expensesTable.amount}), 0)::int` })
    .from(expensesTable)
    .where(and(eq(expensesTable.expenseDate, today), eq(expensesTable.status, "approved")));

  // 10. Today's pending/awaiting expenses grouped by submitter (personal liability)
  const pendingExpensesRows = await db
    .select({
      submittedBy: expensesTable.submittedBy,
      total: sql<number>`SUM(${expensesTable.amount})::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.expenseDate, today), inArray(expensesTable.status, ["pending", "awaiting_second"])))
    .groupBy(expensesTable.submittedBy);

  const approvedExpensesTotal = approvedExpensesRows[0]?.total ?? 0;

  // Summaries
  const totalRevenue = salesTransactions.reduce((s, t) => s + (t.totalAmount ?? 0), 0);
  const totalReceived = receiptsByProduct.reduce((s, r) => s + (r.totalReceived ?? 0), 0);
  const totalProduced = productionByProduct.reduce((s, p) => s + (p.totalProduced ?? 0), 0);
  const totalSoldUnits = (salesByProduct as any[]).reduce((s, p) => s + (p.qtySold ?? 0), 0);
  const remainingStock = inventory.reduce((s, i) => s + (i.currentStock ?? 0), 0);

  // Build accountability per cashier: received units attributed to them (from receipts) + expected cash from sales
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

  // Add people who received goods but have no sales yet
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

  res.json({
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
  });
});

export default router;
