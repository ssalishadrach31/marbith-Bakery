import { Router, type IRouter } from "express";
import { db, paymentsTable, salesTable, ordersTable, wholesaleSuppliesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { RecordPaymentBody, ListPaymentsQueryParams, GetRevenueBreakdownQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payments", async (req, res): Promise<void> => {
  const qp = ListPaymentsQueryParams.safeParse(req.query);
  let records;
  if (qp.success && qp.data.date) {
    records = await db.select().from(paymentsTable).where(sql`DATE(${paymentsTable.recordedAt}) = ${qp.data.date}`).orderBy(paymentsTable.recordedAt);
  } else {
    records = await db.select().from(paymentsTable).orderBy(paymentsTable.recordedAt);
  }
  res.json(records.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })));
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [payment] = await db.insert(paymentsTable).values(parsed.data).returning();
  res.status(201).json({ ...payment, recordedAt: payment.recordedAt.toISOString() });
});

// PATCH /api/payments/:id — correct a payment record
router.patch("/payments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }

  const { transactionId, network, amount, phoneNumber, notes } = req.body;
  const [updated] = await db.update(paymentsTable).set({
    transactionId: transactionId ?? existing.transactionId,
    network: (network ?? existing.network) as any,
    amount: amount !== undefined ? Number(amount) : existing.amount,
    phoneNumber: phoneNumber ?? existing.phoneNumber,
    notes: notes ?? existing.notes,
  }).where(eq(paymentsTable.id, id)).returning();

  res.json({ ...updated, recordedAt: updated.recordedAt.toISOString() });
});

router.get("/payments/revenue-breakdown", async (req, res): Promise<void> => {
  const qp = GetRevenueBreakdownQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date as string : new Date().toISOString().split("T")[0];

  const salesRows = await db.select({
    paymentMethod: salesTable.paymentMethod,
    total: sql<number>`COALESCE(SUM(${salesTable.totalAmount}), 0)`,
  }).from(salesTable).where(sql`DATE(${salesTable.soldAt}) = ${date}`).groupBy(salesTable.paymentMethod);

  const ordersRows = await db.select({
    paymentMethod: ordersTable.paymentMethod,
    total: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)`,
  }).from(ordersTable).where(sql`DATE(${ordersTable.placedAt}) = ${date} AND ${ordersTable.status} != 'cancelled'`).groupBy(ordersTable.paymentMethod);

  const wholesaleRows = await db.select({
    total: sql<number>`COALESCE(SUM(${wholesaleSuppliesTable.amountPaid}), 0)`,
  }).from(wholesaleSuppliesTable).where(sql`DATE(${wholesaleSuppliesTable.suppliedAt}) = ${date}`);

  const shopSalesRevenue = salesRows.reduce((a, r) => a + (r.total ?? 0), 0);
  const onlineOrdersRevenue = ordersRows.reduce((a, r) => a + (r.total ?? 0), 0);
  const wholesaleRevenue = wholesaleRows[0]?.total ?? 0;

  const allRows = [...salesRows, ...ordersRows];
  const cashRevenue = allRows.filter((r) => r.paymentMethod === "cash").reduce((a, r) => a + (r.total ?? 0), 0);
  const mtnMomoRevenue = allRows.filter((r) => r.paymentMethod === "mtn_momo").reduce((a, r) => a + (r.total ?? 0), 0);
  const airtelMoneyRevenue = allRows.filter((r) => r.paymentMethod === "airtel_money").reduce((a, r) => a + (r.total ?? 0), 0);

  res.json({
    date,
    totalRevenue: shopSalesRevenue + onlineOrdersRevenue + wholesaleRevenue,
    cashRevenue,
    mtnMomoRevenue,
    airtelMoneyRevenue,
    shopSalesRevenue,
    onlineOrdersRevenue,
    wholesaleRevenue,
  });
});

export default router;
