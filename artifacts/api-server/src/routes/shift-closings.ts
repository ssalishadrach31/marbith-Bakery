import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

// Create table on first load — no separate migration needed
db.execute(sql`
  CREATE TABLE IF NOT EXISTS shift_closings (
    id SERIAL PRIMARY KEY,
    closed_by TEXT NOT NULL,
    shift_date DATE NOT NULL UNIQUE,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  )
`).catch(() => {});

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// GET /api/shift-closings — list recent closings
router.get("/shift-closings", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const result = await db.execute(sql`
    SELECT id, closed_by, shift_date::text AS shift_date, closed_at, notes
    FROM shift_closings
    ORDER BY shift_date DESC
    LIMIT 60
  `);

  res.json(result.rows.map((r: any) => ({
    id: r.id,
    closedBy: r.closed_by,
    shiftDate: r.shift_date,
    closedAt: r.closed_at,
    notes: r.notes,
  })));
});

// POST /api/shift-closings — close (or re-close) a day
router.post("/shift-closings", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { shiftDate, notes } = req.body;
  const date = shiftDate || new Date().toISOString().split("T")[0];

  const result = await db.execute(sql`
    INSERT INTO shift_closings (closed_by, shift_date, notes)
    VALUES (${user.name || "Staff"}, ${date}::date, ${notes || null})
    ON CONFLICT (shift_date) DO UPDATE
      SET closed_by = EXCLUDED.closed_by,
          closed_at = NOW(),
          notes     = EXCLUDED.notes
    RETURNING id, closed_by, shift_date::text AS shift_date, closed_at, notes
  `);

  const r = result.rows[0] as any;
  res.status(201).json({
    id: r.id, closedBy: r.closed_by, shiftDate: r.shift_date,
    closedAt: r.closed_at, notes: r.notes,
  });
});

export default router;
