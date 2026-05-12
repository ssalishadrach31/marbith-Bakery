import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const inventoryAdjustmentsTable = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  delta: integer("delta").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  adjustedBy: text("adjusted_by").notNull().default("Staff"),
  adjustedAt: timestamp("adjusted_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventoryAdjustment = typeof inventoryAdjustmentsTable.$inferSelect;
