import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const pendingApprovalsTable = pgTable("pending_approvals", {
  id: serial("id").primaryKey(),
  actionType: text("action_type", { enum: ["delete_user", "reset_password"] }).notNull(),
  targetUserId: integer("target_user_id").notNull(),
  targetUserName: text("target_user_name").notNull(),
  targetUsername: text("target_username").notNull(),
  requestedById: integer("requested_by_id").notNull(),
  requestedByName: text("requested_by_name").notNull(),
  newPassword: text("new_password"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewerNotes: text("reviewer_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export type PendingApproval = typeof pendingApprovalsTable.$inferSelect;
