import { pgTable, serial, timestamp, text, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }).notNull().defaultNow(),
  checkOut: timestamp("check_out", { withTimezone: true }),
  date: text("date").notNull(),
  hoursWorked: real("hours_worked"),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
