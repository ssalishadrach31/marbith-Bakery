import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { cockroachDb as db, dailyCountsTable, productsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { notifyByRoles, notifyUsers } from "../lib/notify";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// Create new_day_requests table (raw SQL, like shift_closings)
db.execute(sql`
  CREATE TABLE IF NOT EXISTS new_day_requests (
    id SERIAL PRIMARY KEY,
    requested_by TEXT NOT NULL,
    requested_by_id INTEGER NOT NULL,
    for_date DATE NOT NULL,
    from_date DATE NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMPTZ
  )
`).catch(() => {});

// GET /api/daily-counts?date=YYYY-MM-DD&category=ice_cream|juice
router.get("/daily-counts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const category = req.query.category as string | undefined;

  const rows = await db
    .select({
      id: dailyCountsTable.id,
      productId: dailyCountsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      category: productsTable.category,
      countType: dailyCountsTable.countType,
      quantity: dailyCountsTable.quantity,
      countDate: dailyCountsTable.countDate,
      recordedBy: dailyCountsTable.recordedBy,
      recordedAt: dailyCountsTable.recordedAt,
      notes: dailyCountsTable.notes,
    })
    .from(dailyCountsTable)
    .leftJoin(productsTable, eq(dailyCountsTable.productId, productsTable.id))
    .where(
      category
        ? and(eq(dailyCountsTable.countDate, date), eq(productsTable.category, category as any))
        : eq(dailyCountsTable.countDate, date)
    )
    .orderBy(productsTable.category, productsTable.name, dailyCountsTable.countType);

  res.json(rows.map((r) => ({ ...r, productName: r.productName ?? "Unknown", price: r.price ?? 0 })));
});

// POST /api/daily-counts — upsert opening or closing count
router.post("/daily-counts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { productId, countType, quantity, countDate, notes } = req.body;

  if (!productId || !countType || !["opening", "closing"].includes(countType) || quantity === undefined) {
    res.status(400).json({ error: "productId, countType (opening|closing), and quantity are required" });
    return;
  }

  const today = countDate || new Date().toISOString().split("T")[0];

  const existing = await db
    .select()
    .from(dailyCountsTable)
    .where(
      and(
        eq(dailyCountsTable.productId, Number(productId)),
        eq(dailyCountsTable.countType, countType),
        eq(dailyCountsTable.countDate, today)
      )
    );

  let record;
  if (existing.length > 0) {
    [record] = await db
      .update(dailyCountsTable)
      .set({ quantity: Number(quantity), recordedBy: user.name || "Staff", recordedAt: new Date(), notes: notes || null })
      .where(eq(dailyCountsTable.id, existing[0].id))
      .returning();
  } else {
    [record] = await db.insert(dailyCountsTable).values({
      productId: Number(productId),
      countType,
      quantity: Number(quantity),
      countDate: today,
      recordedBy: user.name || "Staff",
      notes: notes || null,
    }).returning();
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, Number(productId)));
  res.status(201).json({ ...record, productName: product?.name ?? "Unknown", price: product?.price ?? 0 });
});

// ── NEW DAY REQUEST FLOW ────────────────────────────────────────────────────

// GET /api/daily-counts/new-day-request?date=YYYY-MM-DD
// Returns the pending/approved request for the given date, or null
router.get("/daily-counts/new-day-request", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const result = await db.execute(sql`
    SELECT id, requested_by, requested_by_id, for_date::text AS for_date,
           from_date::text AS from_date, requested_at, status, approved_by, approved_at
    FROM new_day_requests
    WHERE for_date = ${date}::date
    ORDER BY requested_at DESC
    LIMIT 1
  `);
  res.json(result.rows[0] ?? null);
});

// POST /api/daily-counts/new-day-request — non-admin submits "start new day" request
router.post("/daily-counts/new-day-request", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role === "admin") {
    res.status(400).json({ error: "Admins can start a new day directly without requesting" });
    return;
  }

  const { fromDate, toDate } = req.body;
  if (!fromDate || !toDate) { res.status(400).json({ error: "fromDate and toDate are required" }); return; }

  const existing = await db.execute(sql`
    SELECT id, status FROM new_day_requests WHERE for_date = ${toDate}::date ORDER BY requested_at DESC LIMIT 1
  `);
  if (existing.rows.length > 0) {
    const row = existing.rows[0] as any;
    if (row.status === "approved") {
      res.status(409).json({ error: "A new day has already been started for this date." });
    } else {
      res.status(409).json({ error: "A request to start the new day is already pending admin approval." });
    }
    return;
  }

  const inserted = await db.execute(sql`
    INSERT INTO new_day_requests (requested_by, requested_by_id, for_date, from_date)
    VALUES (${user.name}, ${user.userId}, ${toDate}::date, ${fromDate}::date)
    RETURNING id, requested_by, requested_by_id,
              for_date::text AS for_date, from_date::text AS from_date,
              requested_at, status, approved_by, approved_at
  `);

  await notifyByRoles(["admin"], {
    type: "system",
    title: "New Day Request",
    message: `${user.name} wants to start a new day — carry forward closing stock from ${fromDate} to ${toDate}. Open the Shift Dashboard to approve or reject.`,
  });

  res.status(201).json(inserted.rows[0]);
});

// PATCH /api/daily-counts/new-day-request/:id — admin approves or rejects
router.patch("/daily-counts/new-day-request/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const { action } = req.body as { action: "approve" | "reject" };
  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be approve or reject" });
    return;
  }

  const found = await db.execute(sql`
    SELECT id, requested_by, requested_by_id, for_date::text AS for_date, from_date::text AS from_date, status
    FROM new_day_requests WHERE id = ${id}
  `);
  if (found.rows.length === 0) { res.status(404).json({ error: "Request not found" }); return; }
  const r = found.rows[0] as any;
  if (r.status !== "pending") { res.status(400).json({ error: "This request has already been processed" }); return; }

  if (action === "approve") {
    // Run the carry-forward
    const closingRows = await db
      .select({ productId: dailyCountsTable.productId, quantity: dailyCountsTable.quantity })
      .from(dailyCountsTable)
      .where(and(eq(dailyCountsTable.countDate, r.from_date), eq(dailyCountsTable.countType, "closing")));

    let carried = 0;
    for (const c of closingRows) {
      const existing = await db
        .select()
        .from(dailyCountsTable)
        .where(and(
          eq(dailyCountsTable.productId, c.productId),
          eq(dailyCountsTable.countType, "opening"),
          eq(dailyCountsTable.countDate, r.for_date)
        ));

      if (existing.length > 0) {
        await db.update(dailyCountsTable)
          .set({ quantity: c.quantity, recordedBy: user.name, recordedAt: new Date() })
          .where(eq(dailyCountsTable.id, existing[0].id));
      } else {
        await db.insert(dailyCountsTable).values({
          productId: c.productId, countType: "opening", quantity: c.quantity,
          countDate: r.for_date, recordedBy: user.name,
        });
      }
      carried++;
    }

    await db.execute(sql`
      UPDATE new_day_requests
      SET status = 'approved', approved_by = ${user.name}, approved_at = NOW()
      WHERE id = ${id}
    `);

    // Notify the requester
    await notifyUsers([r.requested_by_id], {
      type: "system",
      title: "New Day Approved!",
      message: `${user.name} approved your request to start a new day. Opening stock has been set from ${r.from_date}. You can now begin today's shift.`,
    }).catch(() => {});

    res.json({ ok: true, carried, message: `New day approved — ${carried} product${carried !== 1 ? "s" : ""} carried forward as opening stock.` });
  } else {
    await db.execute(sql`
      UPDATE new_day_requests
      SET status = 'rejected', approved_by = ${user.name}, approved_at = NOW()
      WHERE id = ${id}
    `);

    await notifyUsers([r.requested_by_id], {
      type: "system",
      title: "New Day Request Rejected",
      message: `${user.name} rejected your request to start a new day for ${r.for_date}. Please contact your admin for more information.`,
    }).catch(() => {});

    res.json({ ok: true, rejected: true });
  }
});

// POST /api/daily-counts/carry-forward — admin only: directly set opening stock from another date
router.post("/daily-counts/carry-forward", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Only admins can directly start a new day. Please use 'Request New Day' to ask an admin to approve." });
    return;
  }

  const { fromDate, toDate } = req.body;
  if (!fromDate || !toDate) { res.status(400).json({ error: "fromDate and toDate are required" }); return; }

  const closingRows = await db
    .select({ productId: dailyCountsTable.productId, quantity: dailyCountsTable.quantity })
    .from(dailyCountsTable)
    .where(and(eq(dailyCountsTable.countDate, fromDate), eq(dailyCountsTable.countType, "closing")));

  if (closingRows.length === 0) {
    res.json({ carried: 0, message: "No closing counts for that date" });
    return;
  }

  let carried = 0;
  for (const c of closingRows) {
    const existing = await db
      .select()
      .from(dailyCountsTable)
      .where(and(eq(dailyCountsTable.productId, c.productId), eq(dailyCountsTable.countType, "opening"), eq(dailyCountsTable.countDate, toDate)));

    if (existing.length > 0) {
      await db.update(dailyCountsTable)
        .set({ quantity: c.quantity, recordedBy: user.name, recordedAt: new Date() })
        .where(eq(dailyCountsTable.id, existing[0].id));
    } else {
      await db.insert(dailyCountsTable).values({
        productId: c.productId, countType: "opening", quantity: c.quantity,
        countDate: toDate, recordedBy: user.name,
      });
    }
    carried++;
  }

  res.json({ carried, message: `${carried} product${carried !== 1 ? "s" : ""} carried forward as today's opening stock` });
});

export default router;
