import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

function adminOnly(req: any, res: any, next: any) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  next();
}

// GET /api/dev/stats — row counts for all operational tables
router.get("/dev/stats", adminOnly, async (req, res): Promise<void> => {
  const tables = [
    "production", "sales", "sale_items", "shop_receipts",
    "daily_counts", "orders", "order_items", "deliveries",
    "expenses", "payments", "wholesale_supplies", "wholesale_supply_items",
    "salary_payments", "attendance", "notifications", "pending_approvals",
    "inventory",
  ];
  const kept = ["users", "employees", "products", "wholesale_customers"];

  const counts: Record<string, number> = {};
  for (const t of [...tables, ...kept]) {
    const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
    counts[t] = (result.rows[0] as any).n;
  }

  // Inventory stock sum
  const stockResult = await db.execute(sql`SELECT COALESCE(SUM(current_stock),0)::int AS total FROM inventory`);
  const totalStock = (stockResult.rows[0] as any).total;

  res.json({ counts, totalStock, kept });
});

// POST /api/dev/reset — clear specific scope
router.post("/dev/reset", adminOnly, async (req, res): Promise<void> => {
  const { scope } = req.body as { scope: string };

  const validScopes = ["all", "production", "sales", "counts", "orders", "expenses", "attendance", "payments", "notifications", "inventory"];
  if (!scope || !validScopes.includes(scope)) {
    res.status(400).json({ error: `scope must be one of: ${validScopes.join(", ")}` });
    return;
  }

  const cleared: string[] = [];

  if (scope === "all" || scope === "notifications") {
    await db.execute(sql`TRUNCATE TABLE notifications`);
    await db.execute(sql`TRUNCATE TABLE pending_approvals`);
    cleared.push("notifications", "pending_approvals");
  }
  if (scope === "all" || scope === "counts") {
    await db.execute(sql`TRUNCATE TABLE daily_counts`);
    await db.execute(sql`TRUNCATE TABLE shop_receipts`);
    cleared.push("daily_counts", "shop_receipts");
  }
  if (scope === "all" || scope === "production") {
    await db.execute(sql`TRUNCATE TABLE production`);
    cleared.push("production");
  }
  if (scope === "all" || scope === "sales") {
    await db.execute(sql`TRUNCATE TABLE sale_items`);
    await db.execute(sql`TRUNCATE TABLE sales`);
    cleared.push("sales", "sale_items");
  }
  if (scope === "all" || scope === "orders") {
    await db.execute(sql`TRUNCATE TABLE order_items`);
    await db.execute(sql`TRUNCATE TABLE deliveries`);
    await db.execute(sql`TRUNCATE TABLE orders`);
    cleared.push("orders", "order_items", "deliveries");
  }
  if (scope === "all" || scope === "expenses") {
    await db.execute(sql`TRUNCATE TABLE expenses`);
    cleared.push("expenses");
  }
  if (scope === "all" || scope === "payments") {
    await db.execute(sql`TRUNCATE TABLE payments`);
    await db.execute(sql`TRUNCATE TABLE salary_payments`);
    await db.execute(sql`TRUNCATE TABLE wholesale_supply_items`);
    await db.execute(sql`TRUNCATE TABLE wholesale_supplies`);
    cleared.push("payments", "salary_payments", "wholesale_supplies", "wholesale_supply_items");
  }
  if (scope === "all" || scope === "attendance") {
    await db.execute(sql`TRUNCATE TABLE attendance`);
    cleared.push("attendance");
  }
  if (scope === "all" || scope === "inventory") {
    await db.execute(sql`UPDATE inventory SET current_stock = 0`);
    cleared.push("inventory (reset to 0)");
  }

  req.log.info({ scope, cleared }, "Dev reset executed");
  res.json({ ok: true, scope, cleared });
});
export default router;
