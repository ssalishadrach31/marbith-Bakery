import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

const VALID_ROLES = ["admin", "staff", "cashier", "baker", "rider"] as const;

function requireAdmin(req: any, res: any): { userId: number; role: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token" });
    return null;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; role: string };
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return null;
    }
    return payload;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
}

const userFields = {
  id: usersTable.id,
  username: usersTable.username,
  name: usersTable.name,
  role: usersTable.role,
  jobTitle: usersTable.jobTitle,
  isActive: usersTable.isActive,
  employeeId: usersTable.employeeId,
  createdAt: usersTable.createdAt,
};

router.get("/users", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const users = await db.select(userFields).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { username, name, password, role, jobTitle, employeeId } = req.body;

  if (!username || !name || !password || !role) {
    res.status(400).json({ error: "username, name, password and role are required" });
    return;
  }

  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    username,
    name,
    password,
    role,
    jobTitle: jobTitle || null,
    employeeId: employeeId ?? null,
    isActive: true,
  }).returning(userFields);

  res.status(201).json({ ...user, plainPassword: password });
});

router.patch("/users/:id/status", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be boolean" });
    return;
  }

  if (id === admin.userId) {
    res.status(400).json({ error: "Cannot deactivate your own account" });
    return;
  }

  const [user] = await db.update(usersTable).set({ isActive }).where(eq(usersTable.id, id)).returning(userFields);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.patch("/users/:id/password", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  const { password } = req.body;

  if (!password || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  const [user] = await db.update(usersTable).set({ password }).where(eq(usersTable.id, id)).returning(userFields);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...user, plainPassword: password });
});

router.patch("/users/:id/job-title", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  const { jobTitle } = req.body;

  const [user] = await db.update(usersTable).set({ jobTitle: jobTitle || null }).where(eq(usersTable.id, id)).returning(userFields);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (id === admin.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
