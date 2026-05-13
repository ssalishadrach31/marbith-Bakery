import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { notifyByRoles, notifyAllActiveUsers, notifyUsers } from "../lib/notify";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

// Create table with status + approval columns on first load
db.execute(sql`
  CREATE TABLE IF NOT EXISTS shift_closings (
    id SERIAL PRIMARY KEY,
    closed_by TEXT NOT NULL,
    shift_date DATE NOT NULL UNIQUE,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by TEXT,
    approved_at TIMESTAMPTZ
  )
`).then(() => {
  // Migrate existing tables that may be missing the new columns
  return db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_closings' AND column_name='status') THEN
        ALTER TABLE shift_closings ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_closings' AND column_name='approved_by') THEN
        ALTER TABLE shift_closings ADD COLUMN approved_by TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_closings' AND column_name='approved_at') THEN
        ALTER TABLE shift_closings ADD COLUMN approved_at TIMESTAMPTZ;
      END IF;
    END
    $$
  `);
}).catch(() => {});

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

function row(r: any) {
  return {
    id: r.id,
    closedBy: r.closed_by,
    shiftDate: r.shift_date,
    closedAt: r.closed_at,
    notes: r.notes,
    status: r.status ?? "approved",
    approvedBy: r.approved_by ?? null,
    approvedAt: r.approved_at ?? null,
  };
}

// GET /api/shift-closings — list recent closings
router.get("/shift-closings", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const result = await db.execute(sql`
    SELECT id, closed_by, shift_date::text AS shift_date, closed_at, notes, status, approved_by, approved_at
    FROM shift_closings
    ORDER BY shift_date DESC
    LIMIT 60
  `);

  res.json(result.rows.map(row));
});

// POST /api/shift-closings — request (non-admin: pending) or close (admin: approved) a day
router.post("/shift-closings", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { shiftDate, notes } = req.body;
  const date = shiftDate || new Date().toISOString().split("T")[0];

  // Block re-closing an already approved day
  const existing = await db.execute(sql`
    SELECT id, status FROM shift_closings WHERE shift_date = ${date}::date
  `);
  if (existing.rows.length > 0 && (existing.rows[0] as any).status === "approved") {
    res.status(409).json({ error: "This day has already been closed and approved. Only one closing per day is allowed." });
    return;
  }

  const isAdmin = user.role === "admin";
  const status = isAdmin ? "approved" : "pending";
  const approvedBy = isAdmin ? user.name : null;

  const result = await db.execute(sql`
    INSERT INTO shift_closings (closed_by, shift_date, notes, status, approved_by, approved_at)
    VALUES (
      ${user.name || "Staff"}, ${date}::date, ${notes || null},
      ${status},
      ${approvedBy},
      ${isAdmin ? new Date().toISOString() : null}
    )
    ON CONFLICT (shift_date) DO UPDATE
      SET closed_by  = EXCLUDED.closed_by,
          closed_at  = NOW(),
          notes      = EXCLUDED.notes,
          status     = EXCLUDED.status,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at
    RETURNING id, closed_by, shift_date::text AS shift_date, closed_at, notes, status, approved_by, approved_at
  `);

  const r = result.rows[0] as any;

  // Notify admins about a pending close request from non-admin staff
  if (!isAdmin && r.status === "pending") {
    const todayLabel = new Date().toLocaleDateString("en-UG", { weekday: "long", month: "long", day: "numeric" });
    await notifyByRoles(["admin"], {
      type: "system",
      title: "Close Day Request",
      message: `${user.name} has requested to close the shift for ${todayLabel}. Please review and approve.`,
    });
  }

  res.status(201).json(row(r));
});

// PATCH /api/shift-closings/:id/approve — admin approves or rejects a pending close
router.patch("/shift-closings/:id/approve", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const { action } = req.body as { action: "approve" | "reject" };

  if (action === "approve") {
    const result = await db.execute(sql`
      UPDATE shift_closings
      SET status = 'approved', approved_by = ${user.name}, approved_at = NOW()
      WHERE id = ${id}
      RETURNING id, closed_by, shift_date::text AS shift_date, closed_at, notes, status, approved_by, approved_at
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const approved = result.rows[0] as any;
    const shiftDate = approved.shift_date;
    // Notify the staff member who requested the close
    const staffRows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.name, approved.closed_by)).catch(() => []);
    if (staffRows.length > 0) {
      await notifyUsers([staffRows[0].id], {
        type: "system",
        title: "Shift Approved!",
        message: `Your close-day request for ${shiftDate} was approved by ${user.name}. Head to the Shift Dashboard to start a new day.`,
      }).catch(() => {});
    }
    // Notify everyone to prepare for a new day
    await notifyAllActiveUsers({
      type: "system",
      title: "New Day Starting",
      message: `${user.name} approved the shift close for ${shiftDate}. Open the Shift Dashboard to carry forward opening stock.`,
    }).catch(() => {});
    res.json(row(approved));
  } else {
    // Reject → delete the pending record so staff can re-submit
    await db.execute(sql`DELETE FROM shift_closings WHERE id = ${id} AND status = 'pending'`);
    res.json({ deleted: true });
  }
});

export default router;
