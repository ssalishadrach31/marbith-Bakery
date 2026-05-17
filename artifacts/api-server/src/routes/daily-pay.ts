import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { neonDb, cockroachDb, attendanceTable, employeesTable, expensesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// GET /api/daily-pay?date=YYYY-MM-DD — admin only
// Returns cashiers who attended on the given date, with daily rate + expense status
router.get("/daily-pay", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

  const attendanceRecords = await cockroachDb
    .select({
      attendanceId: attendanceTable.id,
      employeeId:   attendanceTable.employeeId,
      checkIn:      attendanceTable.checkIn,
      checkOut:     attendanceTable.checkOut,
      hoursWorked:  attendanceTable.hoursWorked,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.date, date));

  const employeeIds = [...new Set(attendanceRecords.map((r) => r.employeeId))];
  const cashiers = employeeIds.length > 0
    ? await neonDb
        .select({ id: employeesTable.id, name: employeesTable.name, salary: employeesTable.salary, role: employeesTable.role })
        .from(employeesTable)
        .where(sql`${employeesTable.id} = ANY(ARRAY[${sql.join(employeeIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
    : [];
  const cashierMap = new Map(cashiers.filter((e) => e.role === "cashier").map((e) => [e.id, e]));

  const attendees = attendanceRecords
    .filter((r) => cashierMap.has(r.employeeId))
    .map((r) => {
      const emp = cashierMap.get(r.employeeId)!;
      return { ...r, name: emp.name, salary: emp.salary };
    });

  const dailySalaryExpenses = await cockroachDb
    .select({
      id:          expensesTable.id,
      description: expensesTable.description,
      amount:      expensesTable.amount,
      status:      expensesTable.status,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.category, "daily_salary"), eq(expensesTable.expenseDate, date)));

  const result = attendees.map((a) => {
    // Daily rate = monthly salary / 26 working days, rounded to nearest 500 UGX
    const rawDaily = a.salary ? a.salary / 26 : 0;
    const dailyRate = a.salary ? Math.round(rawDaily / 500) * 500 : 0;
    const existing = dailySalaryExpenses.find((e) => e.description.includes(a.name));
    return {
      attendanceId:  a.attendanceId,
      employeeId:    a.employeeId,
      name:          a.name,
      salary:        a.salary ?? null,
      dailyRate,
      checkIn:       a.checkIn,
      checkOut:      a.checkOut,
      hoursWorked:   a.hoursWorked ?? null,
      alreadySubmitted: !!existing,
      expenseId:     existing?.id ?? null,
      expenseStatus: existing?.status ?? null,
      expenseAmount: existing?.amount ?? null,
    };
  });

  res.json(result);
});

export default router;
