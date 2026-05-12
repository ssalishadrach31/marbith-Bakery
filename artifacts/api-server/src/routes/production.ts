import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, productionTable, productsTable, inventoryTable, salesTable, saleItemsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { CreateProductionBody, ListProductionQueryParams, GetProductionDailyReportQueryParams } from "@workspace/api-zod";
import { notifyByRoles } from "../lib/notify";

const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
function getUserName(req: any): string {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return "Staff";
  try { const p = jwt.verify(h.slice(7), JWT_SECRET) as any; return p.name || "Staff"; } catch { return "Staff"; }
}

const router: IRouter = Router();

router.get("/production", async (req, res): Promise<void> => {
  const queryParams = ListProductionQueryParams.safeParse(req.query);
  let rows;
  if (queryParams.success && queryParams.data.date) {
    const dateStr = queryParams.data.date as string;
    rows = await db
      .select({
        id: productionTable.id,
        productId: productionTable.productId,
        productName: productsTable.name,
        quantity: productionTable.quantity,
        entryType: productionTable.entryType,
        producedAt: productionTable.producedAt,
        recordedBy: productionTable.recordedBy,
        notes: productionTable.notes,
      })
      .from(productionTable)
      .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
      .where(sql`DATE(${productionTable.producedAt}) = ${dateStr}`)
      .orderBy(productionTable.producedAt);
  } else {
    rows = await db
      .select({
        id: productionTable.id,
        productId: productionTable.productId,
        productName: productsTable.name,
        quantity: productionTable.quantity,
        entryType: productionTable.entryType,
        producedAt: productionTable.producedAt,
        recordedBy: productionTable.recordedBy,
        notes: productionTable.notes,
      })
      .from(productionTable)
      .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
      .orderBy(productionTable.producedAt);
  }
  res.json(rows.map((r) => ({ ...r, productName: r.productName ?? "Unknown" })));
});

router.get("/production/today-summary", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select({
      productId: productionTable.productId,
      productName: productsTable.name,
      totalProduced: sql<number>`SUM(${productionTable.quantity})::int`,
    })
    .from(productionTable)
    .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
    .where(
      and(
        sql`DATE(${productionTable.producedAt}) = ${today}`,
        sql`${productionTable.entryType} IN ('leftover','new_batch')`
      )
    )
    .groupBy(productionTable.productId, productsTable.name);
  res.json(rows.map((r) => ({ productId: r.productId, productName: r.productName ?? "Unknown", totalProduced: r.totalProduced ?? 0 })));
});

// Admin daily report: per-product stock breakdown + full sales list
router.get("/production/daily-report", async (req, res): Promise<void> => {
  const qp = GetProductionDailyReportQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date as string : new Date().toISOString().split("T")[0];

  // Production entries for the day grouped by product + type
  const prodRows = await db
    .select({
      productId: productionTable.productId,
      productName: productsTable.name,
      quantity: productionTable.quantity,
      entryType: productionTable.entryType,
      price: productsTable.price,
    })
    .from(productionTable)
    .leftJoin(productsTable, eq(productionTable.productId, productsTable.id))
    .where(sql`DATE(${productionTable.producedAt}) = ${date}`);

  // Sale items for the day (to compute sold per product)
  const saleItemRows = await db
    .select({
      productId: saleItemsTable.productId,
      quantity: saleItemsTable.quantity,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(sql`DATE(${salesTable.soldAt}) = ${date}`);

  // Sales list for the day
  const salesList = await db
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
    .where(sql`DATE(${salesTable.soldAt}) = ${date}`)
    .groupBy(salesTable.id)
    .orderBy(salesTable.soldAt);

  // Build per-product aggregates
  const productMap = new Map<number, { productName: string; price: number; leftover: number; newBatch: number; closing: number }>();
  for (const r of prodRows) {
    if (!productMap.has(r.productId)) {
      productMap.set(r.productId, { productName: r.productName ?? "Unknown", price: r.price ?? 0, leftover: 0, newBatch: 0, closing: 0 });
    }
    const entry = productMap.get(r.productId)!;
    if (r.entryType === "leftover") entry.leftover += r.quantity;
    else if (r.entryType === "new_batch") entry.newBatch += r.quantity;
    else if (r.entryType === "closing") entry.closing = r.quantity; // use latest closing value
  }

  // Build sold quantities from sale items
  const soldMap = new Map<number, number>();
  for (const r of saleItemRows) {
    soldMap.set(r.productId, (soldMap.get(r.productId) ?? 0) + r.quantity);
  }

  const productRows = Array.from(productMap.entries()).map(([productId, data]) => {
    const opening = data.leftover + data.newBatch;
    const soldFromItems = soldMap.get(productId) ?? 0;
    const sold = soldFromItems > 0 ? soldFromItems : Math.max(0, opening - data.closing);
    const revenue = soldFromItems * data.price;
    return { productId, productName: data.productName, leftover: data.leftover, newBatch: data.newBatch, opening, closing: data.closing, sold, revenue };
  });

  const totalRevenue = salesList.reduce((a, r) => a + r.totalAmount, 0);
  const totalUnitsSold = saleItemRows.reduce((a, r) => a + r.quantity, 0);

  res.json({
    date,
    productRows,
    sales: salesList.map((r) => ({ ...r, itemCount: r.itemCount ?? 0 })),
    totalRevenue,
    totalUnitsSold,
  });
});

router.post("/production", async (req, res): Promise<void> => {
  const parsed = CreateProductionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, quantity, entryType, notes } = parsed.data;

  const [record] = await db.insert(productionTable).values({
    productId,
    quantity,
    entryType: entryType ?? "new_batch",
    notes: notes ?? null,
    recordedBy: getUserName(req),
  }).returning();

  // Update inventory based on entry type
  const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, productId));

  if (entryType === "closing") {
    // Evening closing: SET stock to the exact remaining count
    if (inv) {
      await db.update(inventoryTable).set({ currentStock: quantity, lastUpdated: new Date() }).where(eq(inventoryTable.productId, productId));
    } else {
      await db.insert(inventoryTable).values({ productId, currentStock: quantity });
    }
  } else {
    // leftover or new_batch: ADD to current stock
    if (inv) {
      await db.update(inventoryTable).set({ currentStock: inv.currentStock + quantity, lastUpdated: new Date() }).where(eq(inventoryTable.productId, productId));
    } else {
      await db.insert(inventoryTable).values({ productId, currentStock: quantity });
    }
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  const productName = product?.name ?? "Unknown";

  const typeLabel = entryType === "leftover" ? "yesterday's leftover added" : entryType === "closing" ? "evening closing stock set" : "new batch baked";
  notifyByRoles(["admin", "staff", "baker"], {
    type: "production",
    title: "Stock Updated",
    message: `${getUserName(req)}: ${quantity} × ${productName} — ${typeLabel}`,
    relatedId: record.id,
  });

  res.status(201).json({ ...record, productName });
});

export default router;
