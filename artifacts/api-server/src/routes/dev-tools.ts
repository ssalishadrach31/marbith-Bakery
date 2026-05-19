import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { neonDb, cockroachDb } from "@workspace/db";
import { sql } from "drizzle-orm";
import { usersTable, shopsTable, employeesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
const ALLOWED_USERNAME = "shadrachssali@gmail.com";
const AVAILABLE_PERMISSIONS = ["manage_shops", "view_passwords"] as const;

// Ensure extra_permissions column exists on users (Neon)
neonDb.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_permissions TEXT[] NOT NULL DEFAULT '{}'`)
  .catch(() => {});

function getTokenPayload(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

function adminOnly(req: any, res: any, next: any) {
  const payload = getTokenPayload(req);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  next();
}

async function developerOnly(req: any, res: any, next: any) {
  const payload = getTokenPayload(req);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const result = await neonDb.execute(sql`SELECT username FROM users WHERE id = ${payload.userId} LIMIT 1`);
  const user = result.rows[0] as any;
  if (!user || user.username !== ALLOWED_USERNAME) {
    res.status(403).json({ error: "Access restricted to the system developer" });
    return;
  }
  next();
}

function requirePermission(perm: string) {
  return async (req: any, res: any, next: any): Promise<void> => {
    const payload = getTokenPayload(req);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (payload.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
    const result = await neonDb.execute(sql`SELECT username, extra_permissions FROM users WHERE id = ${payload.userId} LIMIT 1`);
    const user = result.rows[0] as any;
    if (!user) { res.status(403).json({ error: "User not found" }); return; }
    if (user.username === ALLOWED_USERNAME) { next(); return; }
    const perms: string[] = user.extra_permissions ?? [];
    if (perms.includes(perm)) { next(); return; }
    res.status(403).json({ error: "Access restricted — you don't have this permission" });
  };
}

// Neon tables
const neonTables = ["users", "employees", "orders", "order_items", "payments", "login_logs"];
// CockroachDB tables
const cockroachTables = [
  "production", "sales", "sale_items", "shop_receipts",
  "daily_counts", "deliveries", "expenses",
  "wholesale_supplies", "wholesale_supply_items", "wholesale_customers",
  "salary_payments", "attendance", "notifications", "pending_approvals",
  "inventory", "products",
];

router.get("/dev/stats", adminOnly, async (req, res): Promise<void> => {
  const counts: Record<string, number> = {};
  for (const t of neonTables) {
    try {
      const result = await neonDb.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
      counts[t] = (result.rows[0] as any).n ?? 0;
    } catch { counts[t] = -1; }
  }
  for (const t of cockroachTables) {
    try {
      const result = await cockroachDb.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
      counts[t] = (result.rows[0] as any).n ?? 0;
    } catch { counts[t] = -1; }
  }
  const stockResult = await cockroachDb.execute(sql`SELECT COALESCE(SUM(current_stock),0)::int AS total FROM inventory`);
  const totalStock = (stockResult.rows[0] as any).total;
  res.json({ counts, totalStock });
});

router.post("/dev/reset", adminOnly, async (req, res): Promise<void> => {
  const { scope } = req.body as { scope: string };
  const validScopes = ["all", "production", "sales", "counts", "orders", "expenses", "attendance", "payments", "notifications", "inventory"];
  if (!scope || !validScopes.includes(scope)) {
    res.status(400).json({ error: `scope must be one of: ${validScopes.join(", ")}` });
    return;
  }
  const cleared: string[] = [];
  if (scope === "all" || scope === "notifications") {
    await cockroachDb.execute(sql`TRUNCATE TABLE notifications`);
    await cockroachDb.execute(sql`TRUNCATE TABLE pending_approvals`);
    cleared.push("notifications", "pending_approvals");
  }
  if (scope === "all" || scope === "counts") {
    await cockroachDb.execute(sql`TRUNCATE TABLE daily_counts`);
    await cockroachDb.execute(sql`TRUNCATE TABLE shop_receipts`);
    cleared.push("daily_counts", "shop_receipts");
  }
  if (scope === "all" || scope === "production") {
    await cockroachDb.execute(sql`TRUNCATE TABLE production`);
    cleared.push("production");
  }
  if (scope === "all" || scope === "sales") {
    await cockroachDb.execute(sql`TRUNCATE TABLE sale_items`);
    await cockroachDb.execute(sql`TRUNCATE TABLE sales`);
    cleared.push("sales", "sale_items");
  }
  if (scope === "all" || scope === "orders") {
    await neonDb.execute(sql`TRUNCATE TABLE order_items`);
    await cockroachDb.execute(sql`TRUNCATE TABLE deliveries`);
    await neonDb.execute(sql`TRUNCATE TABLE orders`);
    cleared.push("orders", "order_items", "deliveries");
  }
  if (scope === "all" || scope === "expenses") {
    await cockroachDb.execute(sql`TRUNCATE TABLE expenses`);
    cleared.push("expenses");
  }
  if (scope === "all" || scope === "payments") {
    await neonDb.execute(sql`TRUNCATE TABLE payments`);
    await cockroachDb.execute(sql`TRUNCATE TABLE salary_payments`);
    await cockroachDb.execute(sql`TRUNCATE TABLE wholesale_supply_items`);
    await cockroachDb.execute(sql`TRUNCATE TABLE wholesale_supplies`);
    cleared.push("payments", "salary_payments", "wholesale_supplies", "wholesale_supply_items");
  }
  if (scope === "all" || scope === "attendance") {
    await cockroachDb.execute(sql`TRUNCATE TABLE attendance`);
    cleared.push("attendance");
  }
  if (scope === "all" || scope === "inventory") {
    await cockroachDb.execute(sql`UPDATE inventory SET current_stock = 0`);
    cleared.push("inventory (reset to 0)");
  }
  req.log.info({ scope, cleared }, "Dev reset executed");
  res.json({ ok: true, scope, cleared });
});

router.get("/dev/my-permissions", adminOnly, async (req, res): Promise<void> => {
  const payload = getTokenPayload(req);
  const result = await neonDb.execute(sql`SELECT username, extra_permissions FROM users WHERE id = ${payload!.userId} LIMIT 1`);
  const user = result.rows[0] as any;
  const isDeveloper = user?.username === ALLOWED_USERNAME;
  res.json({
    isDeveloper,
    permissions: isDeveloper ? [...AVAILABLE_PERMISSIONS] : (user?.extra_permissions ?? []),
  });
});

router.get("/dev/users-passwords", requirePermission("view_passwords"), async (_req, res): Promise<void> => {
  const users = await neonDb.select({
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

router.get("/dev/admin-users", developerOnly, async (_req, res): Promise<void> => {
  const result = await neonDb.execute(sql`
    SELECT id, name, username, extra_permissions
    FROM users
    WHERE role = 'admin' AND username != ${ALLOWED_USERNAME}
    ORDER BY name
  `);
  res.json(result.rows);
});

router.patch("/dev/admin-users/:id/permissions", developerOnly, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { permission, grant } = req.body as { permission: string; grant: boolean };
  if (!(AVAILABLE_PERMISSIONS as readonly string[]).includes(permission)) {
    res.status(400).json({ error: `permission must be one of: ${AVAILABLE_PERMISSIONS.join(", ")}` });
    return;
  }
  if (grant) {
    await neonDb.execute(sql`
      UPDATE users
      SET extra_permissions = array_append(extra_permissions, ${permission})
      WHERE id = ${id} AND NOT (extra_permissions @> ARRAY[${permission}]::text[])
    `);
  } else {
    await neonDb.execute(sql`
      UPDATE users SET extra_permissions = array_remove(extra_permissions, ${permission}) WHERE id = ${id}
    `);
  }
  const result = await neonDb.execute(sql`SELECT id, name, username, extra_permissions FROM users WHERE id = ${id}`);
  if (!result.rows[0]) { res.status(404).json({ error: "User not found" }); return; }
  res.json(result.rows[0]);
});

router.get("/dev/shops", requirePermission("manage_shops"), async (_req, res): Promise<void> => {
  const shops = await neonDb.select().from(shopsTable).orderBy(shopsTable.createdAt);
  const employees = await neonDb
    .select({ id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, shopId: employeesTable.shopId })
    .from(employeesTable);
  const result = shops.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    employees: employees.filter((e) => e.shopId === s.id),
  }));
  res.json(result);
});

router.post("/dev/shops", requirePermission("manage_shops"), async (req, res): Promise<void> => {
  const { name, location, address, phone } = req.body as {
    name: string; location: string; address?: string; phone?: string;
  };
  if (!name?.trim() || !location?.trim()) {
    res.status(400).json({ error: "name and location are required" });
    return;
  }
  const [shop] = await neonDb.insert(shopsTable).values({
    name: name.trim(),
    location: location.trim(),
    address: address?.trim() || null,
    phone: phone?.trim() || null,
    isActive: true,
  }).returning();
  res.json({ ...shop, createdAt: shop.createdAt.toISOString(), employees: [] });
});

router.patch("/dev/shops/:id/toggle", requirePermission("manage_shops"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await neonDb.select().from(shopsTable).where(eq(shopsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Shop not found" }); return; }
  const [updated] = await neonDb.update(shopsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(shopsTable.id, id))
    .returning();
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.patch("/dev/employees/:id/shop", requirePermission("manage_shops"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { shopId } = req.body as { shopId: number | null };
  const [updated] = await neonDb.update(employeesTable)
    .set({ shopId: shopId ?? null })
    .where(eq(employeesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(updated);
});

export default router;
