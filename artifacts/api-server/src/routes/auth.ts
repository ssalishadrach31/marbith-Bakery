import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is inactive" });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "12h" });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      jobTitle: user.jobTitle ?? null,
      employeeId: user.employeeId,
    },
  });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  let payload: { userId: number };
  try { payload = jwt.verify(h.slice(7), JWT_SECRET) as any; }
  catch { res.status(401).json({ error: "Invalid token" }); return; }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "currentPassword and newPassword are required" }); return; }
  if (newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.password !== currentPassword) { res.status(401).json({ error: "Current password is incorrect" }); return; }

  await db.update(usersTable).set({ password: newPassword }).where(eq(usersTable.id, payload.userId));
  res.json({ success: true });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      jobTitle: user.jobTitle ?? null,
      employeeId: user.employeeId,
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
