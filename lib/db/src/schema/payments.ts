import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { salesTable } from "./sales";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  network: text("network", { enum: ["mtn_momo", "airtel_money", "cash"] }).notNull(),
  amount: real("amount").notNull(),
  phoneNumber: text("phone_number").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  saleId: integer("sale_id").references(() => salesTable.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, recordedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
