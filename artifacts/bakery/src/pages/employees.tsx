import { useState } from "react";
import { useListEmployees, useCreateEmployee, useDeleteEmployee, useListAttendance, useCheckIn, useCheckOut, getListEmployeesQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatDateTime, formatUGX, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Trash2, UserCheck, UserX, Pencil } from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Request failed (${res.status})`); }
  return res.json();
}

const ROLES = ["admin", "baker", "cashier", "rider"] as const;
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  baker: "bg-amber-100 text-amber-700",
  cashier: "bg-blue-100 text-blue-700",
  rider: "bg-green-100 text-green-700",
};

const EMPTY_FORM = { name: "", role: "cashier" as typeof ROLES[number], phone: "", email: "", salary: "", joinDate: new Date().toISOString().split("T")[0] };

export default function EmployeesPage() {
  const { data: employees, isLoading } = useListEmployees({ query: { queryKey: getListEmployeesQueryKey() } });
  const { data: attendance } = useListAttendance(undefined, { query: { queryKey: getListAttendanceQueryKey() } });
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const today = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance?.filter((a) => a.date === today) ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createEmployee.mutateAsync({ data: { ...form, salary: form.salary ? parseFloat(form.salary) : undefined } });
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Employee added" });
    } catch { toast({ title: "Error adding employee", variant: "destructive" }); }
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiFetch(`/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...data, salary: data.salary ? parseFloat(data.salary) : undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setEditingId(null);
      toast({ title: "Employee updated" });
    },
    onError: (err: any) => toast({ title: "Error updating employee", description: err.message, variant: "destructive" }),
  });

  function openEdit(emp: any) {
    setEditForm({
      name: emp.name ?? "",
      role: emp.role ?? "cashier",
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      salary: emp.salary != null ? String(emp.salary) : "",
      joinDate: emp.joinDate ?? new Date().toISOString().split("T")[0],
    });
    setEditingId(emp.id);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    try {
      await deleteEmployee.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      toast({ title: "Employee deleted" });
    } catch { toast({ title: "Error deleting employee", variant: "destructive" }); }
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
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (!employees || employees.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-10">No employees yet</p>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <Card key={emp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{emp.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[emp.role]}`}>{emp.role}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {emp.phone && (
                            <div><span className="font-medium text-foreground/70">Phone:</span> {emp.phone}</div>
                          )}
                          {emp.email && (
                            <div className="col-span-2 truncate"><span className="font-medium text-foreground/70">Email:</span> {emp.email}</div>
                          )}
                          <div><span className="font-medium text-foreground/70">Salary:</span> {emp.salary ? formatUGX(emp.salary) : "—"}</div>
                          <div><span className="font-medium text-foreground/70">Joined:</span> {emp.joinDate ?? "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit employee"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                          title="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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

      {/* Add Employee dialog */}
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

      {/* Edit Employee dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingId !== null) updateMutation.mutate({ id: editingId, data: editForm });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as typeof ROLES[number] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Monthly Salary (UGX, optional)</Label>
              <Input type="number" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Join Date</Label>
              <Input type="date" value={editForm.joinDate} onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
