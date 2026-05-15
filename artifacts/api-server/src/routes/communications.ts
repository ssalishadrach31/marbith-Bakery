import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { notifyAllActiveUsers, notifyByRoles } from "../lib/notify";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

// Create tables on first load (no migration needed)
db.execute(sql`
  CREATE TABLE IF NOT EXISTS memos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    posted_by TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    priority TEXT NOT NULL DEFAULT 'normal',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ
  )
`).catch(() => {});

db.execute(sql`
  CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    submitted_by_name TEXT NOT NULL,
    submitted_by_role TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'open',
    admin_reply TEXT,
    replied_by TEXT,
    replied_at TIMESTAMPTZ
  )
`).catch(() => {});

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

function memoRow(r: any) {
  return {
    id: r.id, title: r.title, message: r.message,
    postedBy: r.posted_by, postedAt: r.posted_at,
    priority: r.priority, isPinned: r.is_pinned, expiresAt: r.expires_at ?? null,
  };
}

function feedRow(r: any, asAdmin: boolean) {
  return {
    id: r.id, subject: r.subject, message: r.message,
    submittedByName: r.is_anonymous && !asAdmin ? "Anonymous" : r.submitted_by_name,
    submittedByRole: r.submitted_by_role,
    submittedAt: r.submitted_at, isAnonymous: r.is_anonymous,
    status: r.status, adminReply: r.admin_reply ?? null,
    repliedBy: r.replied_by ?? null, repliedAt: r.replied_at ?? null,
  };
}

// ── MEMOS ──────────────────────────────────────────────────────────────────

router.get("/memos", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const result = await db.execute(sql`
    SELECT id, title, message, posted_by, posted_at, priority, is_pinned, expires_at
    FROM memos ORDER BY is_pinned DESC, posted_at DESC LIMIT 200
  `);
  res.json(result.rows.map(memoRow));
});

router.post("/memos", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const { title, message, priority, expiresAt } = req.body;
  if (!title?.trim() || !message?.trim()) { res.status(400).json({ error: "title and message are required" }); return; }
  const result = await db.execute(sql`
    INSERT INTO memos (title, message, posted_by, priority, expires_at)
    VALUES (${title.trim()}, ${message.trim()}, ${user.name}, ${priority || "normal"}, ${expiresAt ? new Date(expiresAt).toISOString() : null})
    RETURNING id, title, message, posted_by, posted_at, priority, is_pinned, expires_at
  `);
  const preview = message.trim().slice(0, 120) + (message.trim().length > 120 ? "…" : "");
  notifyAllActiveUsers({
    type: "system",
    title: `📢 Notice: ${title.trim()}`,
    message: `${user.name}: ${preview}`,
  }).catch(() => {});
  res.status(201).json(memoRow(result.rows[0] as any));
});

router.patch("/memos/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const id = parseInt(req.params.id, 10);
  const { title, message, priority, isPinned } = req.body;
  const result = await db.execute(sql`
    UPDATE memos SET
      title     = COALESCE(${title ?? null}, title),
      message   = COALESCE(${message ?? null}, message),
      priority  = COALESCE(${priority ?? null}, priority),
      is_pinned = COALESCE(${isPinned !== undefined ? isPinned : null}::boolean, is_pinned)
    WHERE id = ${id}
    RETURNING id, title, message, posted_by, posted_at, priority, is_pinned, expires_at
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(memoRow(result.rows[0] as any));
});

router.delete("/memos/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  await db.execute(sql`DELETE FROM memos WHERE id = ${parseInt(req.params.id, 10)}`);
  res.json({ deleted: true });
});

// ── FEEDBACK ────────────────────────────────────────────────────────────────

router.get("/feedback", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const isAdmin = user.role === "admin";
  const result = isAdmin
    ? await db.execute(sql`SELECT * FROM feedback ORDER BY status ASC, submitted_at DESC`)
    : await db.execute(sql`SELECT * FROM feedback WHERE submitted_by_name = ${user.name} ORDER BY submitted_at DESC`);
  res.json(result.rows.map((r) => feedRow(r as any, isAdmin)));
});

router.post("/feedback", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { subject, message, isAnonymous } = req.body;
  if (!subject?.trim() || !message?.trim()) { res.status(400).json({ error: "subject and message are required" }); return; }
  const result = await db.execute(sql`
    INSERT INTO feedback (subject, message, submitted_by_name, submitted_by_role, is_anonymous)
    VALUES (${subject.trim()}, ${message.trim()}, ${user.name}, ${user.role}, ${isAnonymous ? true : false})
    RETURNING id, subject, message, submitted_by_name, submitted_by_role, submitted_at, is_anonymous, status,
              admin_reply, replied_by, replied_at
  `);
  notifyByRoles(["admin"], {
    type: "system",
    title: "New Staff Feedback",
    message: `${isAnonymous ? "Anonymous" : user.name} submitted feedback: "${subject.trim()}"`,
  }).catch(() => {});
  res.status(201).json(feedRow(result.rows[0] as any, false));
});

router.patch("/feedback/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) { res.status(403).json({ error: "Admin only" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { adminReply, status } = req.body;
  const replyVal = adminReply !== undefined && adminReply !== "" ? adminReply : null;
  try {
    const result = await db.execute(sql`
      UPDATE feedback SET
        admin_reply = CASE WHEN ${replyVal}::text IS NOT NULL THEN ${replyVal}::text ELSE admin_reply END,
        replied_by  = CASE WHEN ${replyVal}::text IS NOT NULL THEN ${user.name} ELSE replied_by END,
        replied_at  = CASE WHEN ${replyVal}::text IS NOT NULL THEN NOW() ELSE replied_at END,
        status      = COALESCE(${status ?? null}, status)
      WHERE id = ${id}
      RETURNING id, subject, message, submitted_by_name, submitted_by_role, submitted_at,
                is_anonymous, status, admin_reply, replied_by, replied_at
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Feedback not found" }); return; }
    res.json(feedRow(result.rows[0] as any, true));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update feedback" });
  }
});

export default router;
