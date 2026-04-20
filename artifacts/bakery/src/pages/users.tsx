import { useState } from "react";
import { getToken, getUser, formatDate } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2, KeyRound, UserPlus, Copy, CheckCircle } from "lucide-react";

interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: "admin" | "staff" | "rider";
  isActive: boolean;
  employeeId: number | null;
  createdAt: string;
}

interface NewUserResult extends SystemUser {
  plainPassword: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  rider: "bg-green-100 text-green-700 border-green-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff / Cashier",
  rider: "Rider",
};

async function apiCall(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentUser = getUser();

  const { data: users, isLoading } = useQuery<SystemUser[]>({
    queryKey: ["users"],
    queryFn: () => apiCall("/users"),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => apiCall("/users", { method: "POST", body: JSON.stringify(data) }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiCall(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiCall(`/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiCall(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "staff" });
  const [showPassword, setShowPassword] = useState(false);
  const [newUserResult, setNewUserResult] = useState<NewUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [resetModal, setResetModal] = useState<{ id: number; name: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result: NewUserResult = await createMutation.mutateAsync(form);
      qc.invalidateQueries({ queryKey: ["users"] });
      setNewUserResult(result);
      setShowCreate(false);
      setForm({ username: "", name: "", password: "", role: "staff" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetModal) return;
    try {
      const result = await resetPasswordMutation.mutateAsync({ id: resetModal.id, password: newPwd });
      setResetModal(null);
      setNewPwd("");
      setResetResult({ username: result.username, password: result.plainPassword });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete(user: SystemUser) {
    if (!confirm(`Delete user "${user.name}" (${user.username})? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      toast({ title: "User deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const admins = users?.filter((u) => u.role === "admin") ?? [];
  const staff = users?.filter((u) => u.role === "staff") ?? [];
  const riders = users?.filter((u) => u.role === "rider") ?? [];

  function UserTable({ list, title }: { list: SystemUser[]; title: string }) {
    if (list.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Username</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Role</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Added</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => {
                    const isMe = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className={`border-b border-border last:border-0 ${!u.isActive ? "opacity-60" : "hover:bg-muted/20"}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium">{u.name}</div>
                          {isMe && <div className="text-xs text-primary font-medium">You</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-muted-foreground">{u.username}</td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[u.role]}`}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">{formatDate(u.createdAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.isActive}
                              disabled={isMe || toggleMutation.isPending}
                              onCheckedChange={(v) => toggleMutation.mutate({ id: u.id, isActive: v })}
                              className="scale-75"
                            />
                            <span className={`text-xs ${u.isActive ? "text-green-600" : "text-muted-foreground"}`}>
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => { setResetModal({ id: u.id, name: u.name }); setNewPwd(""); }}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {!isMe && (
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete user"
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Add staff, admins, and riders with login credentials</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Admins", count: admins.length, color: "text-purple-600" },
          { label: "Staff", count: staff.length, color: "text-blue-600" },
          { label: "Riders", count: riders.length, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
      ) : (
        <>
          <UserTable list={admins} title="Admins" />
          <UserTable list={staff} title="Staff / Cashiers" />
          <UserTable list={riders} title="Riders" />
          {(!users || users.length === 0) && (
            <p className="text-center text-muted-foreground py-10">No users found</p>
          )}
        </>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sarah Nakato"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Username <span className="text-muted-foreground text-xs">(used to sign in)</span></Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                placeholder="e.g. sarah.nakato"
                className="mt-1 font-mono"
                required
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full system access</SelectItem>
                  <SelectItem value="staff">Staff / Cashier — POS + Production</SelectItem>
                  <SelectItem value="rider">Rider — deliveries only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Set a password"
                  className="pr-10"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New user credentials dialog */}
      <Dialog open={!!newUserResult} onOpenChange={() => setNewUserResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" /> User Created Successfully
            </DialogTitle>
          </DialogHeader>
          {newUserResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Share these login credentials with <strong>{newUserResult.name}</strong>. Save the password now — it won't be shown again.
              </p>
              <div className="bg-muted rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[newUserResult.role]}`}>
                    {ROLE_LABELS[newUserResult.role]}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
                  <span className="text-sm font-semibold">{newUserResult.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</span>
                  <span className="text-sm font-mono font-bold">{newUserResult.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</span>
                  <span className="text-sm font-mono font-bold text-primary">{newUserResult.plainPassword}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(`Username: ${newUserResult.username}\nPassword: ${newUserResult.plainPassword}`)}
              >
                {copied ? <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy credentials"}
              </Button>
              <Button className="w-full" onClick={() => setNewUserResult(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetModal} onOpenChange={() => { setResetModal(null); setNewPwd(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Reset Password — {resetModal?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setResetModal(null)}>Cancel</Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>Reset Password</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset result dialog */}
      <Dialog open={!!resetResult} onOpenChange={() => setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" /> Password Reset
            </DialogTitle>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Username</span>
                  <span className="font-mono font-bold text-sm">{resetResult.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase">New Password</span>
                  <span className="font-mono font-bold text-sm text-primary">{resetResult.password}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(`Username: ${resetResult.username}\nPassword: ${resetResult.password}`)}
              >
                {copied ? <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy credentials"}
              </Button>
              <Button className="w-full" onClick={() => setResetResult(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
