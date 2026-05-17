import { neonDb, cockroachDb, usersTable, notificationsTable } from "@workspace/db";
import { inArray, eq, and } from "drizzle-orm";
import { logger } from "./logger";

type NotifyPayload = {
  type: "sale" | "production" | "salary" | "expense" | "order" | "attendance" | "system";
  title: string;
  message: string;
  relatedId?: number;
};

export async function notifyByRoles(roles: string[], payload: NotifyPayload): Promise<void> {
  try {
    const users = await neonDb
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(inArray(usersTable.role, roles as any[]), eq(usersTable.isActive, true)));
    if (users.length === 0) return;
    await cockroachDb.insert(notificationsTable).values(users.map((u) => ({ userId: u.id, ...payload })));
  } catch (err) {
    logger.error({ err }, "Failed to send role notifications");
  }
}

export async function notifyAllActiveUsers(payload: NotifyPayload): Promise<void> {
  try {
    const users = await neonDb
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));
    if (users.length === 0) return;
    await cockroachDb.insert(notificationsTable).values(users.map((u) => ({ userId: u.id, ...payload })));
  } catch (err) {
    logger.error({ err }, "Failed to send all-user notifications");
  }
}

export async function notifyUsers(userIds: number[], payload: NotifyPayload): Promise<void> {
  try {
    if (userIds.length === 0) return;
    await cockroachDb.insert(notificationsTable).values(userIds.map((id) => ({ userId: id, ...payload })));
  } catch (err) {
    logger.error({ err }, "Failed to send user notifications");
  }
}
