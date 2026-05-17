import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { cockroachDb as db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

router.get("/notifications", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.userId), eq(notificationsTable.isRead, false)));

  res.json({ count: rows.length });
});

router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, user.userId), eq(notificationsTable.isRead, false)));

  res.json({ success: true });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.userId)));

  res.json({ success: true });
});

export default router;
