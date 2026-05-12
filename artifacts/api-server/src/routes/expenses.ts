import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, expensesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// GET /api/expenses?status=pending|awaiting_second|approved|rejected&month=YYYY-MM
router.get("/expenses", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { status, month } = req.query as Record<string, string>;

  let query = db.select().from(expensesTable);
  const conditions: any[] = [];

  if (status) conditions.push(eq(expensesTable.status, status as any));
  if (month) conditions.push(sql`TO_CHAR(${expensesTable.expenseDate}, 'YYYY-MM') = ${month}`);

  // Non-admins only see their own
  if (user.role !== "admin") conditions.push(eq(expensesTable.submittedBy, user.name));

  const rows = conditions.length > 0
    ? await (query as any).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(sql`${expensesTable.submittedAt} DESC`)
    : await (query as any).orderBy(sql`${expensesTable.submittedAt} DESC`);

  res.json(rows);
});

// GET /api/expenses/report?month=YYYY-MM
router.get("/expenses/report", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  const byCategory = await db
    .select({
      category: expensesTable.category,
      total: sql<number>`SUM(${expensesTable.amount})::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(and(
      sql`TO_CHAR(${expensesTable.expenseDate}, 'YYYY-MM') = ${month}`,
      eq(expensesTable.status, "approved")
    ))
    .groupBy(expensesTable.category)
    .orderBy(sql`SUM(${expensesTable.amount}) DESC`);

  const byPerson = await db
    .select({
      submittedBy: expensesTable.submittedBy,
      total: sql<number>`SUM(${expensesTable.amount})::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(and(
      sql`TO_CHAR(${expensesTable.expenseDate}, 'YYYY-MM') = ${month}`,
      eq(expensesTable.status, "approved")
    ))
    .groupBy(expensesTable.submittedBy)
    .orderBy(sql`SUM(${expensesTable.amount}) DESC`);

  const allApproved = await db
    .select()
    .from(expensesTable)
    .where(and(
      sql`TO_CHAR(${expensesTable.expenseDate}, 'YYYY-MM') = ${month}`,
      eq(expensesTable.status, "approved")
    ))
    .orderBy(expensesTable.expenseDate);

  const totalApproved = byCategory.reduce((s, r) => s + (r.total ?? 0), 0);

  const pendingRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(expensesTable)
    .where(and(
      sql`TO_CHAR(${expensesTable.expenseDate}, 'YYYY-MM') = ${month}`,
      sql`${expensesTable.status} IN ('pending', 'awaiting_second')`
    ));

  res.json({
    month,
    totalApproved,
    pendingCount: pendingRows[0]?.count ?? 0,
    byCategory: byCategory.map((r) => ({ ...r, total: r.total ?? 0, count: r.count ?? 0 })),
    byPerson: byPerson.map((r) => ({ ...r, total: r.total ?? 0, count: r.count ?? 0 })),
    entries: allApproved,
  });
});

// POST /api/expenses — submit an expense
router.post("/expenses", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, description, category, expenseDate } = req.body;
  if (!amount || !description) {
    res.status(400).json({ error: "amount and description are required" });
    return;
  }

  const [record] = await db.insert(expensesTable).values({
    amount: Number(amount),
    description,
    category: category || "other",
    expenseDate: expenseDate || new Date().toISOString().split("T")[0],
    submittedBy: user.name || "Staff",
    status: "pending",
  }).returning();

  res.status(201).json(record);
});

// PATCH /api/expenses/:id/review — dual-approval flow
// First admin: pending → awaiting_second
// Second admin (different person): awaiting_second → approved
// Either admin can reject at any stage
router.patch("/expenses/:id/review", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const { action, reviewNotes } = req.body; // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }

  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!expense) { res.status(404).json({ error: "Expense not found" }); return; }

  if (expense.status === "approved" || expense.status === "rejected") {
    res.status(400).json({ error: "Expense is already finalised" });
    return;
  }

  // ── REJECT at any stage ──
  if (action === "reject") {
    const [record] = await db.update(expensesTable)
      .set({ status: "rejected", reviewedBy: user.name, reviewedAt: new Date(), reviewNotes: reviewNotes || null })
      .where(eq(expensesTable.id, id))
      .returning();
    res.json(record);
    return;
  }

  // ── APPROVE ──
  if (expense.status === "pending") {
    // First approval
    const [record] = await db.update(expensesTable)
      .set({ status: "awaiting_second", firstApprovedBy: user.name, firstApprovedAt: new Date() })
      .where(eq(expensesTable.id, id))
      .returning();
    res.json(record);
    return;
  }

  if (expense.status === "awaiting_second") {
    // Block the same admin from giving the second approval
    if (expense.firstApprovedBy === user.name) {
      res.status(403).json({ error: `You already gave the first approval. A different admin must approve this expense.` });
      return;
    }
    // Second approval — fully approved
    const [record] = await db.update(expensesTable)
      .set({ status: "approved", reviewedBy: user.name, reviewedAt: new Date(), reviewNotes: reviewNotes || null })
      .where(eq(expensesTable.id, id))
      .returning();
    res.json(record);
    return;
  }

  res.status(400).json({ error: "Unexpected expense status" });
});

// DELETE /api/expenses/:id — submitter or admin can delete pending/awaiting_second expense
router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!expense) { res.status(404).json({ error: "Not found" }); return; }
  if (!["pending", "awaiting_second"].includes(expense.status)) {
    res.status(400).json({ error: "Can only delete pending expenses" });
    return;
  }
  if (user.role !== "admin" && expense.submittedBy !== user.name) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.sendStatus(204);
});

export default router;
