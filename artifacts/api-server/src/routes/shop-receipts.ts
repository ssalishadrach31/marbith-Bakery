import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, shopReceiptsTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

router.get("/shop-receipts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

  const rows = await db
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
    .where(sql`DATE(${shopReceiptsTable.receivedAt}) = ${date}`)
    .orderBy(shopReceiptsTable.receivedAt);

  res.json(rows.map((r) => ({ ...r, productName: r.productName ?? "Unknown" })));
});

router.get("/shop-receipts/summary", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];

  const rows = await db
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

  res.json(rows.map((r) => ({
    productId: r.productId,
    productName: r.productName ?? "Unknown",
    price: r.price ?? 0,
    totalReceived: r.totalReceived ?? 0,
  })));
});

router.post("/shop-receipts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { productId, quantityReceived, notes } = req.body;

  if (!productId || !quantityReceived || Number(quantityReceived) <= 0) {
    res.status(400).json({ error: "productId and quantityReceived (> 0) are required" });
    return;
  }

  const [record] = await db.insert(shopReceiptsTable).values({
    productId: Number(productId),
    quantityReceived: Number(quantityReceived),
    receivedBy: user.name || "Staff",
    notes: notes || null,
  }).returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, Number(productId)));

  res.status(201).json({ ...record, productName: product?.name ?? "Unknown" });
});

// PATCH /api/shop-receipts/:id — correct a receipt entry
router.patch("/shop-receipts/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(shopReceiptsTable).where(eq(shopReceiptsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Receipt entry not found" }); return; }

  const newQty = req.body.quantityReceived !== undefined ? parseInt(req.body.quantityReceived, 10) : existing.quantityReceived;
  const newNotes: string | null = req.body.notes !== undefined ? (req.body.notes || null) : existing.notes;

  if (isNaN(newQty) || newQty < 0) { res.status(400).json({ error: "quantityReceived must be non-negative" }); return; }

  const [updated] = await db.update(shopReceiptsTable)
    .set({ quantityReceived: newQty, notes: newNotes })
    .where(eq(shopReceiptsTable.id, id))
    .returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, existing.productId));
  res.json({ ...updated, productName: product?.name ?? "Unknown" });
});

export default router;
