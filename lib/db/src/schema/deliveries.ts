import { pgTable, serial, timestamp, text, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { employeesTable } from "./employees";

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  riderId: integer("rider_id").references(() => employeesTable.id),
  status: text("status", { enum: ["assigned", "picked_up", "delivered", "failed"] }).notNull().default("assigned"),
  deliveryFee: real("delivery_fee").notNull().default(0),
  feeCollected: boolean("fee_collected").notNull().default(false),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({ id: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;
