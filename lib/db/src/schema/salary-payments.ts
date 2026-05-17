import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const salaryPaymentsTable = pgTable("salary_payments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  amount: real("amount").notNull(),
  month: text("month").notNull(),
  method: text("method", { enum: ["cash", "mtn_momo", "airtel_money"] }).notNull().default("cash"),
  notes: text("notes"),
  paidBy: text("paid_by").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalaryPaymentSchema = createInsertSchema(salaryPaymentsTable).omit({ id: true, paidAt: true });
export type InsertSalaryPayment = z.infer<typeof insertSalaryPaymentSchema>;
export type SalaryPayment = typeof salaryPaymentsTable.$inferSelect;
