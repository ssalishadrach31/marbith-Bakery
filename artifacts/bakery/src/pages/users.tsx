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
import {
  Eye, EyeOff, Trash2, KeyRound, UserPlus, Copy, CheckCircle,
  Clock, CheckCircle2, XCircle, ShieldAlert, Bell, Pencil,
} from "lucide-react";

const DEVELOPER_USER_ID = 4;

interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: "admin" | "staff" | "cashier" | "baker" | "rider";
  jobTitle: string | null;
  isActive: boolean;
  employeeId: number | null;
  createdAt: string;
}

interface NewUserResult extends SystemUser { plainPassword: string; }

interface PendingApproval {
  id: number;
  actionType: "delete_user" | "reset_password";
  targetUserId: number;
  targetUserName: string;
  targetUsername: string;
  requestedById: number;
  requestedByName: string;
  newPassword: string | null;
  status: "pending" | "approved" | "rejected";
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700 border-purple-200",
  staff:   "bg-blue-100 text-blue-700 border-blue-200",
  cashier: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baker:   "bg-orange-100 text-orange-700 border-orange-200",
  rider:   "bg-green-100 text-green-700 border-green-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", staff: "Staff", cashier: "Cashier", baker: "Baker / Chef", rider: "Rider",
};

const ROLE_OPTIONS = [
  { value: "admin",   label: "Admin",        desc: "Full access to everything" },
  { value: "staff",   label: "Staff",        desc: "POS Sales + Production" },
  { value: "cashier", label: "Cashier",      desc: "POS / Sales only" },
  { value: "baker",   label: "Baker / Chef", desc: "Production recording only" },
  { value: "rider",   label: "Rider",        desc: "My Deliveries only" },
];

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

const emptyForm = { username: "", name: "", password: "", role: "cashier", jobTitle: "" };

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentUser = getUser();
  const isDeveloper = currentUser?.id === DEVELOPER_USER_ID;

  const { data: users, isLoading } = useQuery<SystemUser[]>({
    queryKey: ["users"],
    queryFn: () => apiCall("/users"),
  });

  const { data: approvals } = useQuery<PendingApproval[]>({
    queryKey: ["approvals"],
    queryFn: () => apiCall("/approvals"),
    refetchInterval: 15_000,
  });

  const pendingApprovals = (approvals ?? []).filter((a) => a.status === "pending");

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

  const queueMutation = useMutation({
    mutationFn: (data: object) => apiCall("/approvals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: "Request sent", description: "Waiting for developer approval" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes: string }) =>
      apiCall(`/approvals/${id}`, { method: "PATCH", body: JSON.stringify({ status, reviewerNotes: notes }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: vars.status === "approved" ? "Action approved and executed" : "Request rejected", variant: vars.status === "approved" ? "default" : "destructive" });
      setReviewApprovalModal(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelApprovalMutation = useMutation({
    mutationFn: (id: number) => apiCall(`/approvals/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast({ title: "Request cancelled" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserResult, setNewUserResult] = useState<NewUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [resetModal, setResetModal] = useState<{ id: number; name: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<SystemUser | null>(null);
  const [queuedModal, setQueuedModal] = useState<"delete" | "reset" | null>(null);

  const [reviewApprovalModal, setReviewApprovalModal] = useState<PendingApproval | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const [tab, setTab] = useState<"users" | "requests">("users");

  const [editModal, setEditModal] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "cashier", jobTitle: "", username: "" });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiCall(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User updated successfully" });
      setEditModal(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openEdit(u: SystemUser) {
    setEditForm({ name: u.name, role: u.role, jobTitle: u.jobTitle ?? "", username: u.username });
    setEditModal(u);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    editMutation.mutate({
      id: editModal.id,
      data: { name: editForm.name, role: editForm.role, jobTitle: editForm.jobTitle || null, username: editForm.username },
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result: NewUserResult = await createMutation.mutateAsync({
        username: form.username, name: form.name, password: form.password,
        role: form.role, jobTitle: form.jobTitle || null,
      });
      qc.invalidateQueries({ queryKey: ["users"] });
      setNewUserResult(result);
      setShowCreate(false);
      setForm(emptyForm);
      setShowPassword(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetModal) return;
    if (isDeveloper) {
      try {
        const result = await resetPasswordMutation.mutateAsync({ id: resetModal.id, password: newPwd });
        setResetModal(null);
        setNewPwd("");
        setResetResult({ username: result.username, password: result.plainPassword });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } else {
      queueMutation.mutate({ actionType: "reset_password", targetUserId: resetModal.id, newPassword: newPwd });
      setResetModal(null);
      setNewPwd("");
      setQueuedModal("reset");
    }
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    if (isDeveloper) {
      try {
        await deleteMutation.mutateAsync(deleteModal.id);
        toast({ title: "User deleted" });
        setDeleteModal(null);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } else {
      queueMutation.mutate({ actionType: "delete_user", targetUserId: deleteModal.id });
      setDeleteModal(null);
      setQueuedModal("delete");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const grouped = {
    admin:   users?.filter((u) => u.role === "admin") ?? [],
    staff:   users?.filter((u) => u.role === "staff") ?? [],
    cashier: users?.filter((u) => u.role === "cashier") ?? [],
    baker:   users?.filter((u) => u.role === "baker") ?? [],
    rider:   users?.filter((u) => u.role === "rider") ?? [],
  };

  const stats = [
    { label: "Admins",       count: grouped.admin.length,   color: "text-purple-600" },
    { label: "Staff",        count: grouped.staff.length,   color: "text-blue-600" },
    { label: "Cashiers",     count: grouped.cashier.length, color: "text-yellow-600" },
    { label: "Bakers/Chefs", count: grouped.baker.length,   color: "text-orange-600" },
    { label: "Riders",       count: grouped.rider.length,   color: "text-green-600" },
  ];

  const ACTION_LABEL: Record<string, string> = {
    delete_user: "Delete User",
    reset_password: "Reset Password",
  };
  const STATUS_STYLE: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700 border-yellow-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-600 border-red-200",
  };

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
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Job Title</th>
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
                    const hasPending = pendingApprovals.some((a) => a.targetUserId === u.id);
                    return (
                      <tr key={u.id} className={`border-b border-border last:border-0 ${!u.isActive ? "opacity-60" : "hover:bg-muted/20"}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{u.name}</span>
                            {hasPending && !isDeveloper && (
                              <span title="Pending request" className="text-yellow-500">
                                <Clock className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          {isMe && <div className="text-xs text-primary font-medium">You</div>}
                          {u.id === DEVELOPER_USER_ID && <div className="text-xs text-purple-600 font-medium">Developer</div>}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {u.jobTitle || <span className="text-muted-foreground/40 italic">—</span>}
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
                          <div className="flex gap-1.5 justify-end items-center">
                            {!isDeveloper && hasPending ? (
                              <span className="text-xs text-yellow-600 flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1">
                                <Clock className="h-3 w-3" /> Awaiting approval
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEdit(u)}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="Edit user details"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {!isMe && (
                                  <button
                                    onClick={() => { setResetModal({ id: u.id, name: u.name }); setNewPwd(""); }}
                                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    title="Reset password"
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </button>
                                )}
                                {!isMe && u.id !== DEVELOPER_USER_ID && (
                                  <button
                                    onClick={() => setDeleteModal(u)}
                                    className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Delete user"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
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
          <p className="text-muted-foreground text-sm mt-0.5">Add staff, set job titles, and control what each person can access</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Dev-only notice */}
      {!isDeveloper && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Restricted actions require developer approval</p>
            <p className="text-amber-700 mt-0.5">Resetting passwords and deleting users will be queued for the system developer to approve before taking effect.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          All Users
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Bell className="h-3.5 w-3.5" />
          {isDeveloper ? "Approval Requests" : "My Requests"}
          {pendingApprovals.length > 0 && (
            <span className="ml-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full px-1.5 py-0.5 font-bold border border-yellow-200">
              {pendingApprovals.length}
            </span>
          )}
        </button>
      </div>

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-2">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Permissions guide */}
          <Card className="bg-muted/40 border-dashed">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What each role can see</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                {ROLE_OPTIONS.map((r) => (
                  <div key={r.value} className="flex flex-col gap-1">
                    <span className={`px-2 py-0.5 rounded-full border font-medium self-start ${ROLE_COLORS[r.value]}`}>{r.label}</span>
                    <span className="text-muted-foreground pl-0.5">{r.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <>
              <UserTable list={grouped.admin}   title="Admins" />
              <UserTable list={grouped.staff}   title="Staff (POS + Production)" />
              <UserTable list={grouped.cashier} title="Cashiers (POS only)" />
              <UserTable list={grouped.baker}   title="Bakers / Chefs (Production only)" />
              <UserTable list={grouped.rider}   title="Riders" />
              {(!users || users.length === 0) && (
                <p className="text-center text-muted-foreground py-10">No users found</p>
              )}
            </>
          )}
        </>
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === "requests" && (
        <div className="space-y-4">
          {isDeveloper && pendingApprovals.length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              <Bell className="h-4 w-4 shrink-0" />
              <span><strong>{pendingApprovals.length}</strong> request{pendingApprovals.length !== 1 ? "s" : ""} waiting for your approval</span>
            </div>
          )}

          {(approvals ?? []).length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
              <p className="font-medium">No requests yet</p>
              <p className="text-sm">{isDeveloper ? "All clear — no pending approvals." : "You haven't submitted any requests."}</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Action</th>
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Target User</th>
                        {isDeveloper && <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Requested by</th>}
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                        <th className="text-center py-2.5 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(approvals ?? []).sort((a, b) => {
                        if (a.status === "pending" && b.status !== "pending") return -1;
                        if (b.status === "pending" && a.status !== "pending") return 1;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      }).map((a) => (
                        <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                          <td className="py-3 px-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${a.actionType === "delete_user" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                              {ACTION_LABEL[a.actionType]}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{a.targetUserName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{a.targetUsername}</div>
                          </td>
                          {isDeveloper && (
                            <td className="py-3 px-4 text-sm text-muted-foreground">{a.requestedByName}</td>
                          )}
                          <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">{formatDate(a.createdAt)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[a.status]}`}>
                              {a.status === "pending" ? "Pending" : a.status === "approved" ? "Approved" : "Rejected"}
                            </span>
                            {a.reviewerNotes && (
                              <div className="text-xs text-muted-foreground mt-0.5 italic">"{a.reviewerNotes}"</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {a.status === "pending" && isDeveloper && (
                              <button
                                onClick={() => { setReviewApprovalModal(a); setReviewNotes(""); }}
                                className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                              >
                                Review
                              </button>
                            )}
                            {a.status === "pending" && !isDeveloper && (
                              <button
                                onClick={() => cancelApprovalMutation.mutate(a.id)}
                                className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
                                disabled={cancelApprovalMutation.isPending}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── DIALOGS ── */}

      {/* Create User */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) { setForm(emptyForm); setShowPassword(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Nakato" className="mt-1" required />
            </div>
            <div>
              <Label>Job Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Samosa Chef" className="mt-1" />
            </div>
            <div>
              <Label>System Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {r.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email / Username</Label>
              <div className="flex mt-1 gap-0">
                <Input
                  value={form.username.replace("@marbithbakery.com", "")}
                  onChange={(e) => {
                    const raw = e.target.value.toLowerCase().replace(/\s/g, "");
                    setForm({ ...form, username: raw ? `${raw}@marbithbakery.com` : "" });
                  }}
                  placeholder="firstname.lastname"
                  className="rounded-r-none font-mono z-10"
                  required
                />
                <span className="flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-xs text-muted-foreground whitespace-nowrap">
                  @marbithbakery.com
                </span>
              </div>
              {form.username && (
                <p className="text-xs text-muted-foreground mt-1 pl-1">Login: <span className="font-mono text-foreground">{form.username}</span></p>
              )}
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
                  required minLength={4}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setForm(emptyForm); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create User"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New user credentials */}
      <Dialog open={!!newUserResult} onOpenChange={() => setNewUserResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" /> User Created Successfully
            </DialogTitle>
          </DialogHeader>
          {newUserResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Share these login credentials with <strong>{newUserResult.name}</strong>. Save the password now — it won't be shown again.</p>
              <div className="bg-muted rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[newUserResult.role]}`}>{ROLE_LABELS[newUserResult.role]}</span>
                </div>
                {newUserResult.jobTitle && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</span>
                    <span className="text-sm font-medium">{newUserResult.jobTitle}</span>
                  </div>
                )}
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
              <Button variant="outline" className="w-full" onClick={() => copyToClipboard(`Name: ${newUserResult.name}\nUsername: ${newUserResult.username}\nPassword: ${newUserResult.plainPassword}`)}>
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
          {!isDeveloper && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This will be sent to the developer for approval. The password won't change until it's approved.</span>
            </div>
          )}
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
                  required minLength={4}
                />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setResetModal(null)}>Cancel</Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending || queueMutation.isPending}>
                {isDeveloper ? "Reset Password" : "Submit for Approval"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset result (developer only) */}
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
              <Button variant="outline" className="w-full" onClick={() => copyToClipboard(`Username: ${resetResult.username}\nPassword: ${resetResult.password}`)}>
                {copied ? <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy credentials"}
              </Button>
              <Button className="w-full" onClick={() => setResetResult(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteModal} onOpenChange={(v) => { if (!v) setDeleteModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isDeveloper ? "text-destructive" : "text-foreground"}`}>
              <Trash2 className="h-5 w-5" /> {isDeveloper ? "Delete User?" : "Request User Deletion"}
            </DialogTitle>
          </DialogHeader>
          {deleteModal && (
            <div className="space-y-4">
              {!isDeveloper && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>This request will be queued for the developer to approve. The user will not be deleted until approved.</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {isDeveloper ? "Are you sure you want to permanently delete" : "Request deletion of"} <strong>{deleteModal.name}</strong>?
                {isDeveloper && " This cannot be undone."}
              </p>
              <div className="bg-muted/40 rounded-lg p-3 text-sm font-mono text-muted-foreground">{deleteModal.username}</div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteModal(null)}>Cancel</Button>
                <Button
                  variant={isDeveloper ? "destructive" : "default"}
                  className="flex-1"
                  disabled={deleteMutation.isPending || queueMutation.isPending}
                  onClick={confirmDelete}
                >
                  {isDeveloper ? (deleteMutation.isPending ? "Deleting..." : "Yes, Delete") : (queueMutation.isPending ? "Submitting..." : "Submit Request")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Queued confirmation notice */}
      <Dialog open={!!queuedModal} onOpenChange={() => setQueuedModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700">
              <Clock className="h-5 w-5" /> Waiting for Developer Approval
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your request to <strong>{queuedModal === "delete" ? "delete this user" : "reset this password"}</strong> has been sent to the system developer for approval.
            </p>
            <p className="text-sm text-muted-foreground">You can track the status in the <strong>My Requests</strong> tab. The action will only be carried out once approved.</p>
            <Button className="w-full" onClick={() => { setQueuedModal(null); setTab("requests"); }}>
              View My Requests
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={!!editModal} onOpenChange={(v) => { if (!v) setEditModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit User — {editModal?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g. Sarah Nakato"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Job Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={editForm.jobTitle}
                onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                placeholder="e.g. Samosa Chef"
                className="mt-1"
              />
            </div>
            <div>
              <Label>System Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {r.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Username</Label>
              <div className="flex mt-1 gap-0">
                <Input
                  value={editForm.username.replace("@marbithbakery.com", "")}
                  onChange={(e) => {
                    const raw = e.target.value.toLowerCase().replace(/\s/g, "");
                    setEditForm({ ...editForm, username: raw ? `${raw}@marbithbakery.com` : "" });
                  }}
                  placeholder="firstname.lastname"
                  className="rounded-r-none font-mono z-10"
                  required
                />
                <span className="flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-xs text-muted-foreground whitespace-nowrap">
                  @marbithbakery.com
                </span>
              </div>
              {editForm.username && (
                <p className="text-xs text-muted-foreground mt-1 pl-1">Login: <span className="font-mono text-foreground">{editForm.username}</span></p>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Developer: Review approval modal */}
      <Dialog open={!!reviewApprovalModal} onOpenChange={(v) => { if (!v) { setReviewApprovalModal(null); setReviewNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
          </DialogHeader>
          {reviewApprovalModal && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action</span>
                  <span className={`font-medium text-xs px-2 py-0.5 rounded-full border ${reviewApprovalModal.actionType === "delete_user" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                    {ACTION_LABEL[reviewApprovalModal.actionType]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target user</span>
                  <span className="font-medium">{reviewApprovalModal.targetUserName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested by</span>
                  <span className="font-medium">{reviewApprovalModal.requestedByName}</span>
                </div>
                {reviewApprovalModal.actionType === "reset_password" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New password</span>
                    <span className="font-mono font-bold text-primary">{reviewApprovalModal.newPassword}</span>
                  </div>
                )}
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input className="mt-1" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Reason for rejection, or leave blank" />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: reviewApprovalModal.id, status: "approved", notes: reviewNotes })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: reviewApprovalModal.id, status: "rejected", notes: reviewNotes })}
                >
                  <XCircle className="h-4 w-4 mr-1.5" /> Reject
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setReviewApprovalModal(null); setReviewNotes(""); }}>Cancel</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
