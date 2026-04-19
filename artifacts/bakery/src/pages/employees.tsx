import { useState } from "react";
import { useListEmployees, useCreateEmployee, useDeleteEmployee, useListAttendance, useCheckIn, useCheckOut, getListEmployeesQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatDateTime, formatUGX } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserCheck, UserX } from "lucide-react";

const ROLES = ["admin", "baker", "cashier", "rider"] as const;
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  baker: "bg-amber-100 text-amber-700",
  cashier: "bg-blue-100 text-blue-700",
  rider: "bg-green-100 text-green-700",
};

export default function EmployeesPage() {
  const { data: employees, isLoading } = useListEmployees({ query: { queryKey: getListEmployeesQueryKey() } });
  const { data: attendance } = useListAttendance({ query: { queryKey: getListAttendanceQueryKey() } });
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "cashier" as typeof ROLES[number], phone: "", email: "", salary: "", joinDate: new Date().toISOString().split("T")[0] });

  const today = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance?.filter((a) => a.date === today) ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createEmployee.mutateAsync({ data: { ...form, salary: form.salary ? parseFloat(form.salary) : undefined } });
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setShowForm(false);
      setForm({ name: "", role: "cashier", phone: "", email: "", salary: "", joinDate: new Date().toISOString().split("T")[0] });
      toast({ title: "Employee added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this employee?")) return;
    try {
      await deleteEmployee.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      toast({ title: "Employee deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function handleCheckIn(employeeId: number) {
    try {
      await checkIn.mutateAsync({ data: { employeeId } });
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      toast({ title: "Checked in" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function handleCheckOut(recordId: number) {
    try {
      await checkOut.mutateAsync({ id: recordId });
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      toast({ title: "Checked out" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>Add Employee</Button>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Team</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Today</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Salary</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees?.map((emp) => (
                        <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{emp.name}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[emp.role]}`}>{emp.role}</span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{emp.phone}</td>
                          <td className="py-3 px-4 hidden md:table-cell">{emp.salary ? formatUGX(emp.salary) : "-"}</td>
                          <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{emp.joinDate}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!employees || employees.length === 0) && <p className="text-sm text-muted-foreground text-center py-10">No employees yet</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Today's Attendance — {today}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employees?.map((emp) => {
                  const record = todayAttendance.find((a) => a.employeeId === emp.id);
                  return (
                    <div key={emp.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <div className="text-sm font-medium">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {record ? `In: ${formatDateTime(record.checkIn)}${record.checkOut ? ` | Out: ${formatDateTime(record.checkOut)}` : " | Still in"}` : "Not checked in"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!record && (
                          <Button size="sm" variant="outline" onClick={() => handleCheckIn(emp.id)}>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />Check In
                          </Button>
                        )}
                        {record && !record.checkOut && (
                          <Button size="sm" variant="outline" onClick={() => handleCheckOut(record.id)}>
                            <UserX className="h-3.5 w-3.5 mr-1" />Check Out
                          </Button>
                        )}
                        {record?.checkOut && (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : "Done"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof ROLES[number] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Monthly Salary (UGX, optional)</Label>
              <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Join Date</Label>
              <Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createEmployee.isPending}>Add Employee</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
