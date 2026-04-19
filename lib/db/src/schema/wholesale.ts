import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const wholesaleCustomersTable = pgTable("wholesale_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull(),
  phone: text("phone").notNull(),
  location: text("location").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wholesaleSuppliesTable = pgTable("wholesale_supplies", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => wholesaleCustomersTable.id),
  totalAmount: real("total_amount").notNull(),
  paymentStatus: text("payment_status", { enum: ["paid", "unpaid", "credit"] }).notNull().default("unpaid"),
  amountPaid: real("amount_paid").notNull().default(0),
  notes: text("notes"),
  suppliedAt: timestamp("supplied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wholesaleSupplyItemsTable = pgTable("wholesale_supply_items", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id").notNull().references(() => wholesaleSuppliesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const insertWholesaleCustomerSchema = createInsertSchema(wholesaleCustomersTable).omit({ id: true, createdAt: true });
export type InsertWholesaleCustomer = z.infer<typeof insertWholesaleCustomerSchema>;
export type WholesaleCustomer = typeof wholesaleCustomersTable.$inferSelect;

export const insertWholesaleSupplySchema = createInsertSchema(wholesaleSuppliesTable).omit({ id: true, suppliedAt: true });
export type InsertWholesaleSupply = z.infer<typeof insertWholesaleSupplySchema>;
export type WholesaleSupply = typeof wholesaleSuppliesTable.$inferSelect;
