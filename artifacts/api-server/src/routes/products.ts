import { Router, type IRouter } from "express";
import { db, productsTable, inventoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateProductBody, GetProductParams, UpdateProductBody, UpdateProductParams, DeleteProductParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const inventory = await db.select().from(inventoryTable);
  const invMap = new Map(inventory.map((i) => [i.productId, i.currentStock]));
  const result = products.map((p) => ({
    ...p,
    currentStock: invMap.get(p.id) ?? 0,
  }));
  res.json(result);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.insert(productsTable).values(parsed.data).returning();
  await db.insert(inventoryTable).values({ productId: product.id, currentStock: 0 });
  res.status(201).json({ ...product, currentStock: 0 });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, product.id));
  res.json({ ...product, currentStock: inv?.currentStock ?? 0 });
});

router.put("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.update(productsTable).set(parsed.data).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, product.id));
  res.json({ ...product, currentStock: inv?.currentStock ?? 0 });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
