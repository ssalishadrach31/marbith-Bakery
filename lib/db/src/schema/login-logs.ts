import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginLogsTable = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  userName: text("user_name").notNull(),
  role: text("role").notNull(),
  loginAt: timestamp("login_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
});

export type LoginLog = typeof loginLogsTable.$inferSelect;
