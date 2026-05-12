import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, pendingApprovalsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

const DEVELOPER_USER_ID = 4;

function requireAdmin(req: any, res: any): { userId: number; role: string; name: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "No token" }); return null; }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; role: string; name: string };
    if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return null; }
    return payload;
  } catch {
    res.status(401).json({ error: "Invalid token" }); return null;
  }
}

function isDeveloper(userId: number) {
  return userId === DEVELOPER_USER_ID;
}

router.get("/approvals", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!isDeveloper(admin.userId)) {
    const mine = await db.select().from(pendingApprovalsTable)
      .where(eq(pendingApprovalsTable.requestedById, admin.userId))
      .orderBy(pendingApprovalsTable.createdAt);
    res.json(mine);
    return;
  }
  const all = await db.select().from(pendingApprovalsTable).orderBy(pendingApprovalsTable.createdAt);
  res.json(all);
});

router.post("/approvals", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (isDeveloper(admin.userId)) {
    res.status(400).json({ error: "Developer can perform actions directly" });
    return;
  }

  const { actionType, targetUserId, newPassword } = req.body;
  if (!actionType || !targetUserId) {
    res.status(400).json({ error: "actionType and targetUserId are required" });
    return;
  }
  if (actionType === "reset_password" && (!newPassword || newPassword.length < 4)) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  const [target] = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, targetUserId));
  if (!target) { res.status(404).json({ error: "Target user not found" }); return; }

  if (target.id === admin.userId) {
    res.status(400).json({ error: "Cannot request actions on your own account" });
    return;
  }

  const existing = await db.select({ id: pendingApprovalsTable.id })
    .from(pendingApprovalsTable)
    .where(and(
      eq(pendingApprovalsTable.targetUserId, targetUserId),
      eq(pendingApprovalsTable.actionType, actionType),
      eq(pendingApprovalsTable.status, "pending")
    ));
  if (existing.length > 0) {
    res.status(409).json({ error: "A pending request for this action already exists" });
    return;
  }

  const [approval] = await db.insert(pendingApprovalsTable).values({
    actionType,
    targetUserId: target.id,
    targetUserName: target.name,
    targetUsername: target.username,
    requestedById: admin.userId,
    requestedByName: admin.name,
    newPassword: actionType === "reset_password" ? newPassword : null,
  }).returning();

  res.status(201).json(approval);
});

router.patch("/approvals/:id", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (!isDeveloper(admin.userId)) {
    res.status(403).json({ error: "Only the system developer can approve or reject requests" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  const { status, reviewerNotes } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }

  const [approval] = await db.select().from(pendingApprovalsTable).where(eq(pendingApprovalsTable.id, id));
  if (!approval) { res.status(404).json({ error: "Approval not found" }); return; }
  if (approval.status !== "pending") { res.status(400).json({ error: "Already reviewed" }); return; }

  if (status === "approved") {
    if (approval.actionType === "delete_user") {
      await db.delete(usersTable).where(eq(usersTable.id, approval.targetUserId));
    } else if (approval.actionType === "reset_password" && approval.newPassword) {
      await db.update(usersTable).set({ password: approval.newPassword }).where(eq(usersTable.id, approval.targetUserId));
    }
  }

  const [updated] = await db.update(pendingApprovalsTable)
    .set({ status, reviewerNotes: reviewerNotes ?? null, reviewedAt: new Date() })
    .where(eq(pendingApprovalsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/approvals/:id", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  const [approval] = await db.select().from(pendingApprovalsTable).where(eq(pendingApprovalsTable.id, id));
  if (!approval) { res.status(404).json({ error: "Not found" }); return; }

  const canCancel = isDeveloper(admin.userId) || approval.requestedById === admin.userId;
  if (!canCancel) { res.status(403).json({ error: "Not allowed" }); return; }
  if (approval.status !== "pending") { res.status(400).json({ error: "Cannot cancel a reviewed request" }); return; }

  await db.delete(pendingApprovalsTable).where(eq(pendingApprovalsTable.id, id));
  res.sendStatus(204);
});

export default router;
