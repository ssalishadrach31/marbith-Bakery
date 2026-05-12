import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, employeesTable, attendanceTable, deliveriesTable, salaryPaymentsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { CreateEmployeeBody, GetEmployeeParams, UpdateEmployeeBody, UpdateEmployeeParams, DeleteEmployeeParams, CheckInBody, CheckOutParams, ListAttendanceQueryParams } from "@workspace/api-zod";
import { notifyAllActiveUsers } from "../lib/notify";

const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
function getUserName(req: any): string {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return "Admin";
  try { const p = jwt.verify(h.slice(7), JWT_SECRET) as any; return p.name || "Admin"; } catch { return "Admin"; }
}

const router: IRouter = Router();

router.get("/employees", async (_req, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
  res.json(employees);
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [emp] = await db.insert(employeesTable).values({
    ...parsed.data,
    joinDate: parsed.data.joinDate ?? new Date().toISOString().split("T")[0],
    isActive: parsed.data.isActive ?? true,
  }).returning();
  res.status(201).json(emp);
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetEmployeeParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(emp);
});

router.put("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEmployeeParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [emp] = await db.update(employeesTable).set(parsed.data).where(eq(employeesTable.id, params.data.id)).returning();
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(emp);
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteEmployeeParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const empId = params.data.id;
  // Clear FK references before deleting the employee
  await db.delete(attendanceTable).where(eq(attendanceTable.employeeId, empId));
  await db.update(deliveriesTable).set({ riderId: null }).where(eq(deliveriesTable.riderId, empId));
  await db.delete(employeesTable).where(eq(employeesTable.id, empId));
  res.sendStatus(204);
});

// Attendance
router.get("/attendance", async (req, res): Promise<void> => {
  const qp = ListAttendanceQueryParams.safeParse(req.query);
  let records;
  if (qp.success && qp.data.employeeId) {
    records = await db.select().from(attendanceTable).where(eq(attendanceTable.employeeId, qp.data.employeeId)).orderBy(attendanceTable.checkIn);
  } else if (qp.success && qp.data.date) {
    records = await db.select().from(attendanceTable).where(eq(attendanceTable.date, qp.data.date as string)).orderBy(attendanceTable.checkIn);
  } else {
    records = await db.select().from(attendanceTable).orderBy(attendanceTable.checkIn);
  }

  const result = await Promise.all(records.map(async (r) => {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, r.employeeId));
    return {
      ...r,
      employeeName: emp?.name ?? "Unknown",
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut?.toISOString() ?? null,
    };
  }));
  res.json(result);
});

router.post("/attendance/check-in", async (req, res): Promise<void> => {
  const parsed = CheckInBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const today = new Date().toISOString().split("T")[0];
  const [record] = await db.insert(attendanceTable).values({
    employeeId: parsed.data.employeeId,
    checkIn: new Date(),
    date: today,
  }).returning();

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  res.status(201).json({ ...record, employeeName: emp?.name ?? "Unknown", checkIn: record.checkIn.toISOString(), checkOut: null });
});

router.put("/attendance/:id/check-out", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CheckOutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const checkOut = new Date();
  const [record] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, params.data.id));
  if (!record) { res.status(404).json({ error: "Attendance record not found" }); return; }

  const hoursWorked = (checkOut.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);
  const [updated] = await db.update(attendanceTable).set({ checkOut, hoursWorked }).where(eq(attendanceTable.id, params.data.id)).returning();

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, updated.employeeId));
  res.json({ ...updated, employeeName: emp?.name ?? "Unknown", checkIn: updated.checkIn.toISOString(), checkOut: updated.checkOut?.toISOString() ?? null });
});

// ── Salary Payments ──
router.get("/salary-payments", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(salaryPaymentsTable)
    .orderBy(desc(salaryPaymentsTable.paidAt));
  res.json(rows.map((r) => ({ ...r, paidAt: r.paidAt.toISOString() })));
});

router.get("/salary-payments/employee/:employeeId", async (req, res): Promise<void> => {
  const empId = parseInt(req.params.employeeId as string, 10);
  if (isNaN(empId)) { res.status(400).json({ error: "Invalid employeeId" }); return; }
  const rows = await db
    .select()
    .from(salaryPaymentsTable)
    .where(eq(salaryPaymentsTable.employeeId, empId))
    .orderBy(desc(salaryPaymentsTable.paidAt));
  res.json(rows.map((r) => ({ ...r, paidAt: r.paidAt.toISOString() })));
});

router.post("/salary-payments", async (req, res): Promise<void> => {
  const { employeeId, amount, month, method, notes } = req.body;
  if (!employeeId || !amount || !month) {
    res.status(400).json({ error: "employeeId, amount, and month are required" });
    return;
  }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }

  const paidBy = getUserName(req);
  const [payment] = await db.insert(salaryPaymentsTable).values({
    employeeId,
    employeeName: emp.name,
    amount,
    month,
    method: method ?? "cash",
    notes: notes ?? null,
    paidBy,
  }).returning();

  // Notify everyone — salary transparency for the whole team
  notifyAllActiveUsers({
    type: "salary",
    title: "Salary Payment Recorded",
    message: `${emp.name}'s salary for ${month} — UGX ${Number(amount).toLocaleString()} paid via ${(method ?? "cash").replace("_", " ")} by ${paidBy}`,
    relatedId: payment.id,
  });

  res.status(201).json({ ...payment, paidAt: payment.paidAt.toISOString() });
});

export default router;
