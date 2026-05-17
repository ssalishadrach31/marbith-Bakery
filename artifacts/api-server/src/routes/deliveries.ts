import { Router, type IRouter } from "express";
import { neonDb, cockroachDb, deliveriesTable, ordersTable, employeesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { AssignDeliveryBody, AssignDeliveryParams, UpdateDeliveryStatusBody, UpdateDeliveryStatusParams, ListDeliveriesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function formatDelivery(d: typeof deliveriesTable.$inferSelect) {
  const [order] = await neonDb.select().from(ordersTable).where(eq(ordersTable.id, d.orderId));
  let riderName: string | null = null;
  if (d.riderId) {
    const [emp] = await neonDb.select().from(employeesTable).where(eq(employeesTable.id, d.riderId));
    riderName = emp?.name ?? null;
  }
  return {
    ...d,
    customerName: order?.customerName ?? "Unknown",
    deliveryLocation: order?.deliveryLocation ?? "",
    riderName,
    assignedAt: d.assignedAt?.toISOString() ?? null,
    deliveredAt: d.deliveredAt?.toISOString() ?? null,
  };
}

router.get("/riders", async (_req, res): Promise<void> => {
  const riders = await neonDb.select().from(employeesTable).where(eq(employeesTable.role, "rider"));
  res.json(riders);
});

router.get("/deliveries", async (req, res): Promise<void> => {
  const qp = ListDeliveriesQueryParams.safeParse(req.query);
  let deliveries;
  if (qp.success && qp.data.riderId) {
    deliveries = await cockroachDb.select().from(deliveriesTable).where(eq(deliveriesTable.riderId, qp.data.riderId));
  } else if (qp.success && qp.data.status) {
    deliveries = await cockroachDb.select().from(deliveriesTable).where(eq(deliveriesTable.status, qp.data.status as "assigned" | "picked_up" | "delivered" | "failed"));
  } else {
    deliveries = await cockroachDb.select().from(deliveriesTable);
  }
  const formatted = await Promise.all(deliveries.map(formatDelivery));
  res.json(formatted);
});

router.post("/deliveries/:id/assign", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AssignDeliveryParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AssignDeliveryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Check if delivery exists for this order, create if not
  let [delivery] = await cockroachDb.select().from(deliveriesTable).where(eq(deliveriesTable.orderId, params.data.id));
  if (!delivery) {
    const [inserted] = await cockroachDb.insert(deliveriesTable).values({
      orderId: params.data.id,
      riderId: parsed.data.riderId,
      deliveryFee: parsed.data.deliveryFee,
      status: "assigned",
      feeCollected: false,
      assignedAt: new Date(),
    }).returning();
    delivery = inserted;
  } else {
    const [updated] = await cockroachDb.update(deliveriesTable)
      .set({ riderId: parsed.data.riderId, deliveryFee: parsed.data.deliveryFee, assignedAt: new Date(), status: "assigned" })
      .where(eq(deliveriesTable.id, delivery.id))
      .returning();
    delivery = updated;
  }

  const formatted = await formatDelivery(delivery);
  res.json(formatted);
});

router.put("/deliveries/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDeliveryStatusParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateDeliveryStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof deliveriesTable.$inferInsert> = {
    status: parsed.data.status,
    feeCollected: parsed.data.feeCollected ?? false,
  };
  if (parsed.data.status === "delivered") {
    updates.deliveredAt = new Date();
  }

  const [delivery] = await cockroachDb.update(deliveriesTable).set(updates).where(eq(deliveriesTable.id, params.data.id)).returning();
  if (!delivery) { res.status(404).json({ error: "Delivery not found" }); return; }

  const formatted = await formatDelivery(delivery);
  res.json(formatted);
});

export default router;
