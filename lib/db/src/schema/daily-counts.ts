import { pgTable, text, serial, timestamp, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const dailyCountsTable = pgTable("daily_counts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  countType: text("count_type").notNull().$type<"opening" | "closing">(),
  quantity: integer("quantity").notNull().default(0),
  countDate: date("count_date").notNull().defaultNow(),
  recordedBy: text("recorded_by").notNull().default("Staff"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
}, (t) => [unique().on(t.productId, t.countType, t.countDate)]);

export const insertDailyCountSchema = createInsertSchema(dailyCountsTable).omit({ id: true, recordedAt: true });
export type InsertDailyCount = z.infer<typeof insertDailyCountSchema>;
export type DailyCount = typeof dailyCountsTable.$inferSelect;
