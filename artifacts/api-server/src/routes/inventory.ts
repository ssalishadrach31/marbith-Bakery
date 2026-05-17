import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { cockroachDb as db, inventoryTable, productsTable, inventoryAdjustmentsTable } from "@workspace/db";
import { eq, lte, sql, desc } from "drizzle-orm";
import { AdjustInventoryBody, AdjustInventoryParams } from "@workspace/api-zod";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

function inventoryRow(r: any) {
  const threshold = r.lowStockThreshold ?? 10;
  return {
    ...r,
    productName: r.productName ?? "Unknown",
    lowStockThreshold: threshold,
    isLow: threshold > 0 ? r.currentStock <= threshold : r.currentStock === 0,
    lastUpdated: r.lastUpdated?.toISOString() ?? new Date().toISOString(),
  };
}

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

  res.json(rows.map(inventoryRow));
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

  res.json(rows.map((r) => ({ ...inventoryRow(r), isLow: true })));
});

router.get("/inventory/history", async (req, res): Promise<void> => {
  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const productId = req.query.productId ? Number(req.query.productId) : undefined;

  let query = db
    .select()
    .from(inventoryAdjustmentsTable)
    .where(sql`DATE(${inventoryAdjustmentsTable.adjustedAt}) = ${date}`)
    .orderBy(desc(inventoryAdjustmentsTable.adjustedAt))
    .$dynamic();

  if (productId) {
    query = query.where(eq(inventoryAdjustmentsTable.productId, productId));
  }

  const rows = await query.limit(100);
  res.json(rows.map((r) => ({
    ...r,
    adjustedAt: r.adjustedAt?.toISOString() ?? new Date().toISOString(),
  })));
});

router.post("/inventory/:productId/adjust", async (req, res): Promise<void> => {
  const user = getUser(req);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const params = AdjustInventoryParams.safeParse({ productId: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid productId" }); return; }

  const parsed = AdjustInventoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, params.data.productId));
  if (!inv) {
    // Auto-create inventory row for products that don't have one yet
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.productId));
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    [inv] = await db.insert(inventoryTable)
      .values({ productId: params.data.productId, currentStock: 0, lastUpdated: new Date() })
      .returning();
  }

  const newStock = Math.max(0, inv.currentStock + parsed.data.quantity);
  const [updated] = await db.update(inventoryTable)
    .set({ currentStock: newStock, lastUpdated: new Date() })
    .where(eq(inventoryTable.productId, params.data.productId))
    .returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.productId));

  await db.insert(inventoryAdjustmentsTable).values({
    productId: params.data.productId,
    productName: product?.name ?? "Unknown",
    delta: parsed.data.quantity,
    newStock,
    reason: parsed.data.reason || null,
    adjustedBy: user?.name ?? "Staff",
    adjustedAt: new Date(),
  });

  const threshold = product?.lowStockThreshold ?? 10;
  res.json({
    ...updated,
    productName: product?.name ?? "Unknown",
    lowStockThreshold: threshold,
    isLow: threshold > 0 ? newStock <= threshold : newStock === 0,
    lastUpdated: updated.lastUpdated?.toISOString(),
  });
});

export default router;
