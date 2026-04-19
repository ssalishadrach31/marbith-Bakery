import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  totalAmount: real("total_amount").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "mtn_momo", "airtel_money"] }).notNull(),
  transactionId: text("transaction_id"),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
  soldBy: text("sold_by").notNull().default("staff"),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, soldAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;

export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true });
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItemsTable.$inferSelect;
