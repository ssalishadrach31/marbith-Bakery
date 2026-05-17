import { Router, type IRouter } from "express";
import { cockroachDb, productsTable, inventoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateProductBody, GetProductParams, UpdateProductBody, UpdateProductParams, DeleteProductParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (_req, res): Promise<void> => {
  const products = await cockroachDb.select().from(productsTable).orderBy(productsTable.name);
  const inventory = await cockroachDb.select().from(inventoryTable);
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
  const [product] = await cockroachDb.insert(productsTable).values(parsed.data as any).returning();
  await cockroachDb.insert(inventoryTable).values({ productId: product.id, currentStock: 0 });
  res.status(201).json({ ...product, currentStock: 0 });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [product] = await cockroachDb.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [inv] = await cockroachDb.select().from(inventoryTable).where(eq(inventoryTable.productId, product.id));
  res.json({ ...product, currentStock: inv?.currentStock ?? 0 });
});

router.put("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await cockroachDb.update(productsTable).set(parsed.data as any).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [inv] = await cockroachDb.select().from(inventoryTable).where(eq(inventoryTable.productId, product.id));
  res.json({ ...product, currentStock: inv?.currentStock ?? 0 });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await cockroachDb.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
