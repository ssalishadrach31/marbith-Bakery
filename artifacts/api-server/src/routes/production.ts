import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, productionTable, productsTable, inventoryTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";
import { CreateProductionBody, ListProductionQueryParams } from "@workspace/api-zod";

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

router.post("/production", async (req, res): Promise<void> => {
  const parsed = CreateProductionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db.insert(productionTable).values({
    ...parsed.data,
    recordedBy: getUserName(req),
  }).returning();

  // Update inventory
  const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, parsed.data.productId));
  if (inv) {
    await db.update(inventoryTable).set({ currentStock: inv.currentStock + parsed.data.quantity, lastUpdated: new Date() }).where(eq(inventoryTable.productId, parsed.data.productId));
  } else {
    await db.insert(inventoryTable).values({ productId: parsed.data.productId, currentStock: parsed.data.quantity });
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, record.productId));
  res.status(201).json({ ...record, productName: product?.name ?? "Unknown" });
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
    .where(sql`DATE(${productionTable.producedAt}) = ${today}`)
    .groupBy(productionTable.productId, productsTable.name);
  res.json(rows.map((r) => ({ productId: r.productId, productName: r.productName ?? "Unknown", totalProduced: r.totalProduced ?? 0 })));
});

export default router;
