import { Router, type IRouter } from "express";
import { neonDb, cockroachDb, ordersTable, orderItemsTable, productsTable, inventoryTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { CreateOrderBody, GetOrderParams, UpdateOrderStatusBody, UpdateOrderStatusParams, ListOrdersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrderWithItems(orderId: number) {
  const [order] = await neonDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return null;
  const items = await neonDb
    .select({
      productId: orderItemsTable.productId,
      quantity: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      subtotal: orderItemsTable.subtotal,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));
  const productIds = items.map((i) => i.productId);
  const products = productIds.length > 0
    ? await cockroachDb.select({ id: productsTable.id, name: productsTable.name }).from(productsTable)
        .where(inArray(productsTable.id, productIds))
    : [];
  const pMap = new Map(products.map((p) => [p.id, p.name]));
  return { ...order, items: items.map((i) => ({ ...i, productName: pMap.get(i.productId) ?? "Unknown" })) };
}

router.get("/orders", async (req, res): Promise<void> => {
  const qp = ListOrdersQueryParams.safeParse(req.query);
  let orders;
  if (qp.success && qp.data.status) {
    orders = await neonDb.select().from(ordersTable).where(eq(ordersTable.status, qp.data.status as "pending" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled")).orderBy(ordersTable.placedAt);
  } else {
    orders = await neonDb.select().from(ordersTable).orderBy(ordersTable.placedAt);
  }

  const withItems = await Promise.all(orders.map(async (o) => {
    const items = await neonDb
      .select({
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
        unitPrice: orderItemsTable.unitPrice,
        subtotal: orderItemsTable.subtotal,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, o.id));
    const pids = items.map((i) => i.productId);
    const prods = pids.length > 0
      ? await cockroachDb.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).where(inArray(productsTable.id, pids))
      : [];
    const pm = new Map(prods.map((p) => [p.id, p.name]));
    return { ...o, items: items.map((i) => ({ ...i, productName: pm.get(i.productId) ?? "Unknown" })) };
  }));

  res.json(withItems);
});

router.get("/orders/pending-count", async (_req, res): Promise<void> => {
  const [row] = await neonDb.select({ count: sql<number>`COUNT(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  res.json({ count: row?.count ?? 0 });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetOrderParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const order = await getOrderWithItems(params.data.id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(order);
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, customerPhone, deliveryLocation, paymentMethod, transactionId, items } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const products = await cockroachDb.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    const unitPrice = product?.price ?? 0;
    const subtotal = unitPrice * item.quantity;
    totalAmount += subtotal;
    return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal };
  });

  const [order] = await neonDb.insert(ordersTable).values({
    customerName,
    customerPhone,
    deliveryLocation,
    paymentMethod,
    transactionId: transactionId ?? null,
    totalAmount,
    status: "pending",
  }).returning();

  for (const item of orderItems) {
    await neonDb.insert(orderItemsTable).values({ orderId: order.id, ...item });
    const [inv] = await cockroachDb.select().from(inventoryTable).where(eq(inventoryTable.productId, item.productId));
    if (inv) {
      await cockroachDb.update(inventoryTable).set({ currentStock: Math.max(0, inv.currentStock - item.quantity), lastUpdated: new Date() }).where(eq(inventoryTable.productId, item.productId));
    }
  }

  const fullOrder = await getOrderWithItems(order.id);
  res.status(201).json(fullOrder);
});

router.put("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateOrderStatusParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await neonDb.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, params.data.id));
  const order = await getOrderWithItems(params.data.id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(order);
});

export default router;
