import { Router, type IRouter } from "express";
import { db, inventoryTable, productsTable } from "@workspace/db";
import { eq, lte, sql } from "drizzle-orm";
import { AdjustInventoryBody, AdjustInventoryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/inventory", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: inventoryTable.id,
      productId: inventoryTable.productId,
      productName: productsTable.name,
      currentStock: inventoryTable.currentStock,
      lowStockThreshold: productsTable.lowStockThreshold,
      lastUpdated: inventoryTable.lastUpdated,
    })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .orderBy(productsTable.name);

  res.json(rows.map((r) => ({
    ...r,
    productName: r.productName ?? "Unknown",
    lowStockThreshold: r.lowStockThreshold ?? 10,
    isLow: r.currentStock <= (r.lowStockThreshold ?? 10),
    lastUpdated: r.lastUpdated?.toISOString() ?? new Date().toISOString(),
  })));
});

router.get("/inventory/low-stock", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: inventoryTable.id,
      productId: inventoryTable.productId,
      productName: productsTable.name,
      currentStock: inventoryTable.currentStock,
      lowStockThreshold: productsTable.lowStockThreshold,
      lastUpdated: inventoryTable.lastUpdated,
    })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .where(sql`${inventoryTable.currentStock} <= ${productsTable.lowStockThreshold}`);

  res.json(rows.map((r) => ({
    ...r,
    productName: r.productName ?? "Unknown",
    lowStockThreshold: r.lowStockThreshold ?? 10,
    isLow: true,
    lastUpdated: r.lastUpdated?.toISOString() ?? new Date().toISOString(),
  })));
});

router.post("/inventory/:productId/adjust", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const params = AdjustInventoryParams.safeParse({ productId: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid productId" }); return; }

  const parsed = AdjustInventoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, params.data.productId));
  if (!inv) { res.status(404).json({ error: "Inventory not found" }); return; }

  const newStock = Math.max(0, inv.currentStock + parsed.data.quantity);
  const [updated] = await db.update(inventoryTable)
    .set({ currentStock: newStock, lastUpdated: new Date() })
    .where(eq(inventoryTable.productId, params.data.productId))
    .returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.productId));
  res.json({
    ...updated,
    productName: product?.name ?? "Unknown",
    lowStockThreshold: product?.lowStockThreshold ?? 10,
    isLow: newStock <= (product?.lowStockThreshold ?? 10),
    lastUpdated: updated.lastUpdated?.toISOString(),
  });
});

export default router;
