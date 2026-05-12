import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const productionTable = pgTable("production", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  entryType: text("entry_type", { enum: ["leftover", "new_batch", "closing"] }).notNull().default("new_batch"),
  producedAt: timestamp("produced_at", { withTimezone: true }).notNull().defaultNow(),
  recordedBy: text("recorded_by").notNull().default("staff"),
  notes: text("notes"),
});

export const insertProductionSchema = createInsertSchema(productionTable).omit({ id: true, producedAt: true });
export type InsertProduction = z.infer<typeof insertProductionSchema>;
export type Production = typeof productionTable.$inferSelect;
