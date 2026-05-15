import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { eq, asc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
const ALLOWED_USERNAME = "shadrachssali@gmail.com";

function getTokenPayload(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

async function developerOnly(req: any, res: any, next: any): Promise<void> {
  const payload = getTokenPayload(req);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const result = await db.execute(sql`SELECT username FROM users WHERE id = ${payload.userId} LIMIT 1`);
  const user = result.rows[0] as any;
  if (!user || user.username !== ALLOWED_USERNAME) {
    res.status(403).json({ error: "Access restricted to the system developer" });
    return;
  }
  next();
}

async function buildSystemContext(): Promise<string> {
  const tableNames = [
    "users", "employees", "products", "inventory", "attendance",
    "production", "sales", "orders", "deliveries", "expenses",
    "payments", "wholesale_customers", "notifications", "pending_approvals",
  ];
  const counts: Record<string, number> = {};
  for (const t of tableNames) {
    try {
      const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
      counts[t] = (r.rows[0] as any).n ?? 0;
    } catch { counts[t] = -1; }
  }

  const recentAttendance = await db.execute(sql`
    SELECT e.name, a.check_in, a.check_out, a.date
    FROM attendance a JOIN employees e ON e.id = a.employee_id
    ORDER BY a.date DESC, a.check_in DESC LIMIT 10
  `);

  const recentSales = await db.execute(sql`
    SELECT s.id, s.total, s.payment_method, s.created_at
    FROM sales s ORDER BY s.created_at DESC LIMIT 5
  `);

  const lowStock = await db.execute(sql`
    SELECT p.name, i.current_stock, i.minimum_stock
    FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.current_stock <= i.minimum_stock
    ORDER BY i.current_stock ASC LIMIT 10
  `);

  const pendingApprovals = await db.execute(sql`
    SELECT action, target_user_id, requested_by, status, created_at
    FROM pending_approvals ORDER BY created_at DESC LIMIT 5
  `);

  return `You are the AI assistant for Marbith Bakery and Investments Management System in Kampala, Uganda.
You are speaking with Shadrach Ssali, the system developer (shadrachssali@gmail.com) who has full access to all parts of the system.

SYSTEM OVERVIEW:
- Full-stack bakery management: React + Vite frontend, Express + TypeScript backend, PostgreSQL database
- Currency: UGX (Ugandan Shillings)
- Payments: MTN Mobile Money, Airtel Money, Cash

USER ROLES:
- Admin: shadrachssali@gmail.com (you, developer), martha@marbithbakery.com
- Staff: vivian@marbithbakery.com (Shift Dashboard, POS, Production, Expenses)
- Cashier: sharon@marbithbakery.com (Shift Dashboard, POS, Expenses)
- Baker: samuel@marbithbakery.com, kato@marbithbakery.com (Kitchen Dashboard, Production, Expenses — no POS)
- Rider: rider1 (My Deliveries only)

CURRENT DATABASE STATS:
${Object.entries(counts).map(([t, n]) => `  ${t}: ${n} records`).join("\n")}

RECENT ATTENDANCE (last 10):
${recentAttendance.rows.map((r: any) => `  ${r.name} — in: ${r.check_in ?? "none"}, out: ${r.check_out ?? "none"}, date: ${r.date}`).join("\n") || "  (none)"}

RECENT SALES (last 5):
${recentSales.rows.map((r: any) => `  Sale #${r.id}: ${r.total} UGX via ${r.payment_method} at ${r.created_at}`).join("\n") || "  (none)"}

LOW STOCK ALERTS:
${lowStock.rows.map((r: any) => `  ${r.name}: ${r.current_stock}/${r.minimum_stock}`).join("\n") || "  (none — all stock levels OK)"}

PENDING APPROVALS:
${pendingApprovals.rows.map((r: any) => `  ${r.action} for user ${r.target_user_id} by ${r.requested_by} — ${r.status}`).join("\n") || "  (none)"}

MODULES AVAILABLE:
Dashboard, Production (daily batches), Inventory (stock levels), POS Sales (cart-based), Online Orders, Deliveries (rider tracking), Wholesale (business customers), Employees, Attendance (check-in/out), Payments (MoMo/Airtel), Products, Public Order Form (/order), Rider Portal, Developer Tools

RECENT FIXES MADE:
- Employee name mismatches fixed (Vivian, Kamazoba Martha, Asuman Kato)
- Self check-in now case-insensitive via LOWER() SQL
- Baker dashboard has check-in/check-out widget
- Drinks Fridge Stock: per-row Stock In buttons replace broken dropdown form
- AI chat assistant added to Developer Tools (this feature)

You can help Shadrach:
1. Diagnose errors or inconsistencies in the data
2. Explain what changes were made and why
3. Suggest fixes for reported issues
4. Answer questions about the codebase architecture
5. Analyze the current state of the system from the database stats above
6. Guide troubleshooting of any module

Be concise, technical, and helpful. You have full context of what was built today.`;
}

// GET /api/anthropic/conversations — developer only
router.get("/anthropic/conversations", developerOnly, async (_req, res): Promise<void> => {
  const result = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  res.json(result.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

// POST /api/anthropic/conversations — developer only
router.post("/anthropic/conversations", developerOnly, async (req, res): Promise<void> => {
  const { title } = req.body as { title: string };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  const [conv] = await db.insert(conversations).values({ title: title.trim() }).returning();
  res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
});

// GET /api/anthropic/conversations/:id — developer only
router.get("/anthropic/conversations/:id", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

// DELETE /api/anthropic/conversations/:id — developer only
router.delete("/anthropic/conversations/:id", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.status(204).end();
});

// GET /api/anthropic/conversations/:id/messages — developer only
router.get("/anthropic/conversations/:id/messages", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

// POST /api/anthropic/conversations/:id/messages — developer only, SSE streaming
router.post("/anthropic/conversations/:id/messages", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Save user message
  await db.insert(messages).values({ conversationId: id, role: "user", content: content.trim() });

  // Fetch full history for context
  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build system context
  const systemContext = await buildSystemContext();

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemContext,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    req.log.error({ err }, "Anthropic stream error");
    res.write(`data: ${JSON.stringify({ error: err.message ?? "AI error" })}\n\n`);
  }

  res.end();
});

export default router;
