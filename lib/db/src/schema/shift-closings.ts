import { pgTable, serial, text, timestamp, date } from "drizzle-orm/pg-core";

export const shiftClosingsTable = pgTable("shift_closings", {
  id: serial("id").primaryKey(),
  closedBy: text("closed_by").notNull(),
  shiftDate: date("shift_date").notNull().unique(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export type ShiftClosing = typeof shiftClosingsTable.$inferSelect;
