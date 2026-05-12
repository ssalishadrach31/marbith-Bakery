import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, salesTable, saleItemsTable, productsTable, inventoryTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { CreateSaleBody, GetSaleParams, ListSalesQueryParams, GetDailySalesSummaryQueryParams } from "@workspace/api-zod";
import { notifyByRoles } from "../lib/notify";

const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
function getUserName(req: any): string {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return "Staff";
  try { const p = jwt.verify(h.slice(7), JWT_SECRET) as any; return p.name || "Staff"; } catch { return "Staff"; }
}

const router: IRouter = Router();

function generateReceipt() {
  return `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

router.get("/sales", async (req, res): Promise<void> => {
  const queryParams = ListSalesQueryParams.safeParse(req.query);
  let rows;
  if (queryParams.success && queryParams.data.date) {
    rows = await db
      .select({
        id: salesTable.id,
        receiptNumber: salesTable.receiptNumber,
        totalAmount: salesTable.totalAmount,
        paymentMethod: salesTable.paymentMethod,
        transactionId: salesTable.transactionId,
        soldAt: salesTable.soldAt,
        soldBy: salesTable.soldBy,
        itemCount: sql<number>`COUNT(${saleItemsTable.id})::int`,
      })
      .from(salesTable)
      .leftJoin(saleItemsTable, eq(salesTable.id, saleItemsTable.saleId))
      .where(sql`DATE(${salesTable.soldAt}) = ${queryParams.data.date}`)
      .groupBy(salesTable.id)
      .orderBy(salesTable.soldAt);
  } else {
    rows = await db
      .select({
        id: salesTable.id,
        receiptNumber: salesTable.receiptNumber,
        totalAmount: salesTable.totalAmount,
        paymentMethod: salesTable.paymentMethod,
        transactionId: salesTable.transactionId,
        soldAt: salesTable.soldAt,
        soldBy: salesTable.soldBy,
        itemCount: sql<number>`COUNT(${saleItemsTable.id})::int`,
      })
      .from(salesTable)
      .leftJoin(saleItemsTable, eq(salesTable.id, saleItemsTable.saleId))
      .groupBy(salesTable.id)
      .orderBy(salesTable.soldAt);
  }
  res.json(rows.map((r) => ({ ...r, itemCount: r.itemCount ?? 0 })));
});

router.get("/sales/daily-summary", async (req, res): Promise<void> => {
  const qp = GetDailySalesSummaryQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date as string : new Date().toISOString().split("T")[0];

  const rows = await db.select({
    paymentMethod: salesTable.paymentMethod,
    total: sql<number>`SUM(${salesTable.totalAmount})`,
    count: sql<number>`COUNT(*)::int`,
  }).from(salesTable).where(sql`DATE(${salesTable.soldAt}) = ${date}`).groupBy(salesTable.paymentMethod);

  const cash = rows.find((r) => r.paymentMethod === "cash")?.total ?? 0;
  const mtn = rows.find((r) => r.paymentMethod === "mtn_momo")?.total ?? 0;
  const airtel = rows.find((r) => r.paymentMethod === "airtel_money")?.total ?? 0;
  const totalTx = rows.reduce((a, r) => a + (r.count ?? 0), 0);

  res.json({ date, totalRevenue: cash + mtn + airtel, totalTransactions: totalTx, cashTotal: cash, mtnMomoTotal: mtn, airtelMoneyTotal: airtel });
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSaleParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const items = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      subtotal: saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, params.data.id));

  res.json({ ...sale, items: items.map((i) => ({ ...i, productName: i.productName ?? "Unknown" })) });
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paymentMethod, transactionId, items } = parsed.data;

  // Get products to get their prices
  const productIds = items.map((i) => i.productId);
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const saleItems = items.map((item) => {
    const product = productMap.get(item.productId);
    const unitPrice = product?.price ?? 0;
    const subtotal = unitPrice * item.quantity;
    totalAmount += subtotal;
    return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal };
  });

  const [sale] = await db.insert(salesTable).values({
    receiptNumber: generateReceipt(),
    totalAmount,
    paymentMethod,
    transactionId: transactionId ?? null,
    soldBy: getUserName(req),
  }).returning();

  for (const item of saleItems) {
    await db.insert(saleItemsTable).values({ saleId: sale.id, ...item });
    // Deduct inventory
    const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, item.productId));
    if (inv) {
      await db.update(inventoryTable).set({ currentStock: Math.max(0, inv.currentStock - item.quantity), lastUpdated: new Date() }).where(eq(inventoryTable.productId, item.productId));
    }
  }

  // Notify admins about the new sale (fire-and-forget)
  const itemSummary = saleItems.length === 1
    ? `${saleItems[0].quantity} item`
    : `${saleItems.length} products`;
  notifyByRoles(["admin"], {
    type: "sale",
    title: "New Sale Completed",
    message: `${getUserName(req)} sold ${itemSummary} · UGX ${totalAmount.toLocaleString()} via ${paymentMethod.replace("_", " ")}`,
    relatedId: sale.id,
  });

  res.status(201).json({ ...sale, itemCount: saleItems.length });
});

export default router;
