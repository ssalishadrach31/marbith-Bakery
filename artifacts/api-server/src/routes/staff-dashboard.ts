import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, productionTable, productsTable, salesTable, saleItemsTable, inventoryTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

  // 1. Today's production entries (detailed)
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

  // 3. Today's sales transactions
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

  // 4. Sales by person today
  const salesByPerson = await db
    .select({
      soldBy: salesTable.soldBy,
      transactions: sql<number>`COUNT(*)::int`,
      totalAmount: sql<number>`SUM(${salesTable.totalAmount})`,
    })
    .from(salesTable)
    .where(sql`DATE(${salesTable.soldAt}) = ${today}`)
    .groupBy(salesTable.soldBy);

  // 5. Sales by product today
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

  // 6. Current inventory with price for value calculation
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

  // Calculations
  const totalRevenue = salesTransactions.reduce((s, t) => s + (t.totalAmount ?? 0), 0);
  const totalProducedValue = productionByProduct.reduce((s, p) => s + ((p.totalProduced ?? 0) * (p.price ?? 0)), 0);
  const remainingStockValue = inventory.reduce((s, i) => s + ((i.currentStock ?? 0) * (i.price ?? 0)), 0);

  res.json({
    date: today,
    production: {
      entries: productionEntries.map((e) => ({ ...e, productName: e.productName ?? "Unknown" })),
      byProduct: productionByProduct.map((p) => ({ ...p, productName: p.productName ?? "Unknown", totalProduced: p.totalProduced ?? 0 })),
    },
    sales: {
      transactions: salesTransactions.map((t) => ({ ...t, itemCount: t.itemCount ?? 0 })),
      byPerson: salesByPerson.map((p) => ({ soldBy: p.soldBy, transactions: p.transactions ?? 0, totalAmount: p.totalAmount ?? 0 })),
      byProduct: salesByProduct.map((p) => ({ ...p, productName: p.productName ?? "Unknown", qtySold: p.qtySold ?? 0, revenue: p.revenue ?? 0 })),
      totalRevenue,
      transactionCount: salesTransactions.length,
    },
    inventory: inventory.map((i) => ({ ...i, productName: i.productName ?? "Unknown", stockValue: (i.currentStock ?? 0) * (i.price ?? 0) })),
    summary: {
      totalProducedValue,
      totalRevenue,
      remainingStockValue,
    },
  });
});

export default router;
