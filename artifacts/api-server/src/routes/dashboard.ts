import { Router, type IRouter } from "express";
import { db, productionTable, inventoryTable, productsTable, salesTable, ordersTable, deliveriesTable, employeesTable, wholesaleSuppliesTable, saleItemsTable, orderItemsTable, dailyCountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [productionRow] = await db.select({ total: sql<number>`COALESCE(SUM(${productionTable.quantity}), 0)::int` }).from(productionTable).where(sql`DATE(${productionTable.producedAt}) = ${today}`);

  const inventoryRows = await db.select({ currentStock: inventoryTable.currentStock, lowStockThreshold: productsTable.lowStockThreshold }).from(inventoryTable).leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id));
  const totalStockItems = inventoryRows.reduce((a, r) => a + r.currentStock, 0);
  const lowStockCount = inventoryRows.filter((r) => r.currentStock <= (r.lowStockThreshold ?? 10)).length;

  const [salesRow] = await db.select({ total: sql<number>`COALESCE(SUM(${salesTable.totalAmount}), 0)` }).from(salesTable).where(sql`DATE(${salesTable.soldAt}) = ${today}`);
  const [ordersRow] = await db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)` }).from(ordersTable).where(sql`DATE(${ordersTable.placedAt}) = ${today} AND ${ordersTable.status} != 'cancelled'`);
  const [pendingRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [activeRidersRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable).where(sql`${employeesTable.role} = 'rider' AND ${employeesTable.isActive} = true`);
  const [totalEmpRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable).where(eq(employeesTable.isActive, true));
  const [wholesaleRow] = await db.select({ total: sql<number>`COALESCE(SUM(${wholesaleSuppliesTable.totalAmount} - ${wholesaleSuppliesTable.amountPaid}), 0)` }).from(wholesaleSuppliesTable).where(sql`${wholesaleSuppliesTable.paymentStatus} != 'paid'`);

  // Daily count revenue: (opening - closing) * price for all counted items with both counts entered today
  const countRevenueResult = await db.execute(sql`
    SELECT COALESCE(SUM(GREATEST(0, dc_open.quantity - dc_close.quantity) * p.price), 0)::numeric AS total
    FROM daily_counts dc_open
    JOIN products p ON p.id = dc_open.product_id
    JOIN daily_counts dc_close
      ON dc_close.product_id = dc_open.product_id
      AND dc_close.count_type = 'closing'
      AND dc_close.count_date = ${today}
    WHERE dc_open.count_type = 'opening'
      AND dc_open.count_date = ${today}
  `);
  const todayCountSales = Number((countRevenueResult.rows[0] as any)?.total ?? 0);

  res.json({
    todayProduction: productionRow?.total ?? 0,
    totalStockItems,
    lowStockCount,
    todayShopSales: salesRow?.total ?? 0,
    todayOnlineSales: ordersRow?.total ?? 0,
    todayCountSales,
    todayTotalRevenue: (salesRow?.total ?? 0) + (ordersRow?.total ?? 0) + todayCountSales,
    pendingOrders: pendingRow?.count ?? 0,
    activeRiders: activeRidersRow?.count ?? 0,
    totalEmployees: totalEmpRow?.count ?? 0,
    outstandingWholesale: wholesaleRow?.total ?? 0,
  });
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const recentSales = await db.select({ id: salesTable.id, totalAmount: salesTable.totalAmount, soldAt: salesTable.soldAt }).from(salesTable).orderBy(salesTable.soldAt).limit(5);
  const recentOrders = await db.select({ id: ordersTable.id, customerName: ordersTable.customerName, totalAmount: ordersTable.totalAmount, placedAt: ordersTable.placedAt, status: ordersTable.status }).from(ordersTable).orderBy(ordersTable.placedAt).limit(5);
  const recentProduction = await db.select({ id: productionTable.id, productId: productionTable.productId, quantity: productionTable.quantity, producedAt: productionTable.producedAt }).from(productionTable).orderBy(productionTable.producedAt).limit(5);

  const productNames = new Map<number, string>();
  for (const p of recentProduction) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, p.productId));
    if (product) productNames.set(p.productId, product.name);
  }

  const activities = [
    ...recentSales.map((s) => ({
      id: `sale-${s.id}`,
      type: "sale" as const,
      description: `Shop sale - Receipt #${s.id}`,
      amount: s.totalAmount,
      timestamp: s.soldAt.toISOString(),
    })),
    ...recentOrders.map((o) => ({
      id: `order-${o.id}`,
      type: "order" as const,
      description: `Online order from ${o.customerName} (${o.status})`,
      amount: o.totalAmount,
      timestamp: o.placedAt.toISOString(),
    })),
    ...recentProduction.map((p) => ({
      id: `production-${p.id}`,
      type: "production" as const,
      description: `Produced ${p.quantity}x ${productNames.get(p.productId) ?? "product"}`,
      amount: null,
      timestamp: p.producedAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);

  res.json(activities);
});

export default router;
