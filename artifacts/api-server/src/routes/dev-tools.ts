import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { usersTable, shopsTable, employeesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
const ALLOWED_USERNAME = "shadrachssali@gmail.com";

function getTokenPayload(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// Any admin can view stats and run resets
function adminOnly(req: any, res: any, next: any) {
  const payload = getTokenPayload(req);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  next();
}

// Only Shadrach (system developer) can access sensitive endpoints
async function developerOnly(req: any, res: any, next: any) {
  const payload = getTokenPayload(req);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const [user] = await db.select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user || user.username !== ALLOWED_USERNAME) {
    res.status(403).json({ error: "Access restricted to the system developer" });
    return;
  }
  next();
}

// GET /api/dev/stats — any admin
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

  const stockResult = await db.execute(sql`SELECT COALESCE(SUM(current_stock),0)::int AS total FROM inventory`);
  const totalStock = (stockResult.rows[0] as any).total;

  res.json({ counts, totalStock, kept });
});

// POST /api/dev/reset
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
    await db.execute(sql`TRUNCATE TABLE sale_items, sales CASCADE`);
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

// GET /api/dev/users-passwords — Shadrach only: list all users with their passwords
router.get("/dev/users-passwords", developerOnly, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    name: usersTable.name,
    role: usersTable.role,
    password: usersTable.password,
    isActive: usersTable.isActive,
    jobTitle: usersTable.jobTitle,
  }).from(usersTable).orderBy(usersTable.name);
  res.json(users);
});

// GET /api/dev/shops — list all shops
router.get("/dev/shops", developerOnly, async (_req, res): Promise<void> => {
  const shops = await db
    .select()
    .from(shopsTable)
    .orderBy(shopsTable.createdAt);

  const employees = await db
    .select({ id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, shopId: employeesTable.shopId })
    .from(employeesTable);

  const result = shops.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    employees: employees.filter((e) => e.shopId === s.id),
  }));

  res.json(result);
});

// POST /api/dev/shops — create a new shop
router.post("/dev/shops", developerOnly, async (req, res): Promise<void> => {
  const { name, location, address, phone } = req.body as {
    name: string; location: string; address?: string; phone?: string;
  };
  if (!name?.trim() || !location?.trim()) {
    res.status(400).json({ error: "name and location are required" });
    return;
  }
  const [shop] = await db.insert(shopsTable).values({
    name: name.trim(),
    location: location.trim(),
    address: address?.trim() || null,
    phone: phone?.trim() || null,
    isActive: true,
  }).returning();

  res.json({ ...shop, createdAt: shop.createdAt.toISOString(), employees: [] });
});

// PATCH /api/dev/shops/:id/toggle — activate / deactivate
router.patch("/dev/shops/:id/toggle", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(shopsTable).where(eq(shopsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Shop not found" }); return; }

  const [updated] = await db.update(shopsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(shopsTable.id, id))
    .returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// PATCH /api/dev/employees/:id/shop — assign employee to a shop
router.patch("/dev/employees/:id/shop", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { shopId } = req.body as { shopId: number | null };

  const [updated] = await db.update(employeesTable)
    .set({ shopId: shopId ?? null })
    .where(eq(employeesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(updated);
});

export default router;
