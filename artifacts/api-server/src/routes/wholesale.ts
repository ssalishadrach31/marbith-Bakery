import { Router, type IRouter } from "express";
import { cockroachDb as db, wholesaleCustomersTable, wholesaleSuppliesTable, wholesaleSupplyItemsTable, productsTable, inventoryTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { CreateWholesaleCustomerBody, CreateWholesaleSupplyBody, UpdateSupplyPaymentStatusBody, UpdateSupplyPaymentStatusParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wholesale/customers", async (_req, res): Promise<void> => {
  const customers = await db.select().from(wholesaleCustomersTable).orderBy(wholesaleCustomersTable.name);
  const withBalance = await Promise.all(customers.map(async (c) => {
    const [row] = await db.select({
      outstanding: sql<number>`COALESCE(SUM(${wholesaleSuppliesTable.totalAmount} - ${wholesaleSuppliesTable.amountPaid}), 0)`,
    }).from(wholesaleSuppliesTable).where(eq(wholesaleSuppliesTable.customerId, c.id));
    return { ...c, totalOutstanding: row?.outstanding ?? 0 };
  }));
  res.json(withBalance);
});

router.post("/wholesale/customers", async (req, res): Promise<void> => {
  const parsed = CreateWholesaleCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [customer] = await db.insert(wholesaleCustomersTable).values(parsed.data).returning();
  res.status(201).json({ ...customer, totalOutstanding: 0 });
});

router.get("/wholesale/supplies", async (_req, res): Promise<void> => {
  const supplies = await db.select().from(wholesaleSuppliesTable).orderBy(wholesaleSuppliesTable.suppliedAt);
  const result = await Promise.all(supplies.map(async (s) => {
    const [customer] = await db.select().from(wholesaleCustomersTable).where(eq(wholesaleCustomersTable.id, s.customerId));
    const items = await db
      .select({
        productId: wholesaleSupplyItemsTable.productId,
        productName: productsTable.name,
        quantity: wholesaleSupplyItemsTable.quantity,
        unitPrice: wholesaleSupplyItemsTable.unitPrice,
        subtotal: wholesaleSupplyItemsTable.subtotal,
      })
      .from(wholesaleSupplyItemsTable)
      .leftJoin(productsTable, eq(wholesaleSupplyItemsTable.productId, productsTable.id))
      .where(eq(wholesaleSupplyItemsTable.supplyId, s.id));
    return { ...s, customerName: customer?.name ?? "Unknown", items: items.map((i) => ({ ...i, productName: i.productName ?? "Unknown" })) };
  }));
  res.json(result);
});

router.post("/wholesale/supplies", async (req, res): Promise<void> => {
  const parsed = CreateWholesaleSupplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { customerId, items, paymentStatus, amountPaid, notes } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const supplyItems = items.map((item) => {
    const product = productMap.get(item.productId);
    const unitPrice = product?.price ?? 0;
    const subtotal = unitPrice * item.quantity;
    totalAmount += subtotal;
    return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal };
  });

  const [supply] = await db.insert(wholesaleSuppliesTable).values({ customerId, totalAmount, paymentStatus, amountPaid, notes: notes ?? null }).returning();

  for (const item of supplyItems) {
    await db.insert(wholesaleSupplyItemsTable).values({ supplyId: supply.id, ...item });
    const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.productId, item.productId));
    if (inv) {
      await db.update(inventoryTable).set({ currentStock: Math.max(0, inv.currentStock - item.quantity), lastUpdated: new Date() }).where(eq(inventoryTable.productId, item.productId));
    }
  }

  const [customer] = await db.select().from(wholesaleCustomersTable).where(eq(wholesaleCustomersTable.id, customerId));
  res.status(201).json({ ...supply, customerName: customer?.name ?? "Unknown", items: supplyItems.map((i) => ({ ...i, productName: productMap.get(i.productId)?.name ?? "Unknown" })) });
});

router.put("/wholesale/supplies/:id/payment", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSupplyPaymentStatusParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateSupplyPaymentStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [supply] = await db.update(wholesaleSuppliesTable).set({ paymentStatus: parsed.data.paymentStatus, amountPaid: parsed.data.amountPaid }).where(eq(wholesaleSuppliesTable.id, params.data.id)).returning();
  if (!supply) { res.status(404).json({ error: "Supply not found" }); return; }

  const [customer] = await db.select().from(wholesaleCustomersTable).where(eq(wholesaleCustomersTable.id, supply.customerId));
  const items = await db
    .select({
      productId: wholesaleSupplyItemsTable.productId,
      productName: productsTable.name,
      quantity: wholesaleSupplyItemsTable.quantity,
      unitPrice: wholesaleSupplyItemsTable.unitPrice,
      subtotal: wholesaleSupplyItemsTable.subtotal,
    })
    .from(wholesaleSupplyItemsTable)
    .leftJoin(productsTable, eq(wholesaleSupplyItemsTable.productId, productsTable.id))
    .where(eq(wholesaleSupplyItemsTable.supplyId, supply.id));

  res.json({ ...supply, customerName: customer?.name ?? "Unknown", items: items.map((i) => ({ ...i, productName: i.productName ?? "Unknown" })) });
});

router.get("/wholesale/outstanding-balance", async (_req, res): Promise<void> => {
  const [row] = await db.select({
    totalOutstanding: sql<number>`COALESCE(SUM(${wholesaleSuppliesTable.totalAmount} - ${wholesaleSuppliesTable.amountPaid}), 0)`,
    customerCount: sql<number>`COUNT(DISTINCT ${wholesaleSuppliesTable.customerId})::int`,
  }).from(wholesaleSuppliesTable).where(sql`${wholesaleSuppliesTable.paymentStatus} != 'paid'`);
  res.json({ totalOutstanding: row?.totalOutstanding ?? 0, customerCount: row?.customerCount ?? 0 });
});

export default router;
