import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const shopReceiptsTable = pgTable("shop_receipts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantityReceived: integer("quantity_received").notNull(),
  receivedBy: text("received_by").notNull().default("Staff"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const insertShopReceiptSchema = createInsertSchema(shopReceiptsTable).omit({ id: true, receivedAt: true });
export type InsertShopReceipt = z.infer<typeof insertShopReceiptSchema>;
export type ShopReceipt = typeof shopReceiptsTable.$inferSelect;
