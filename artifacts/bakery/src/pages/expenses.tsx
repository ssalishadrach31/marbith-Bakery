import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser, formatUGX, formatDate, formatDateTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt, Plus, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, BarChart2, Trash2, FileText,
  ShieldCheck, ShieldAlert, UserCheck, Pencil,
} from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.status === 204 ? null : res.json();
}

const CATEGORIES = [
  { value: "supplies",     label: "Supplies / Ingredients" },
  { value: "staff_wages",  label: "Staff Wages / Allowances" },
  { value: "transport",    label: "Transport / Delivery" },
  { value: "utilities",    label: "Utilities (Water, Electricity)" },
  { value: "equipment",    label: "Equipment / Repairs" },
  { value: "other",        label: "Other" },
];

const CAT_COLORS: Record<string, string> = {
  supplies:    "bg-green-100 text-green-700 border-green-200",
  staff_wages: "bg-blue-100 text-blue-700 border-blue-200",
  transport:   "bg-purple-100 text-purple-700 border-purple-200",
  utilities:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  equipment:   "bg-orange-100 text-orange-700 border-orange-200",
  other:       "bg-gray-100 text-gray-600 border-gray-200",
};

function catLabel(c: string) { return CATEGORIES.find((x) => x.value === c)?.label ?? c; }

function StatusBadge({ status, firstApprovedBy }: { status: string; firstApprovedBy?: string | null }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-yellow-100 text-yellow-700 border-yellow-200">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  }
  if (status === "awaiting_second") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-blue-100 text-blue-700 border-blue-200" title={`First approval by ${firstApprovedBy}`}>
        <ShieldAlert className="h-3 w-3" /> 1 of 2 Approved
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-green-100 text-green-700 border-green-200">
        <ShieldCheck className="h-3 w-3" /> Fully Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-red-100 text-red-600 border-red-200">
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  );
}

export default function ExpensesPage() {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"pending" | "all" | "report">(isAdmin ? "pending" : "all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", description: "", category: "other", expenseDate: new Date().toISOString().split("T")[0] });
  const [reviewModal, setReviewModal] = useState<{ id: number; desc: string; status: string; firstApprovedBy: string | null } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ id: number; desc: string } | null>(null);
  const [editModal, setEditModal] = useState<{ id: number; amount: string; description: string; category: string; expenseDate: string } | null>(null);

  // Report month navigation
  const now = new Date();
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const reportMonthStr = `${reportYear}-${String(reportMonth).padStart(2, "0")}`;
  const reportMonthLabel = new Date(reportYear, reportMonth - 1).toLocaleDateString("en-UG", { month: "long", year: "numeric" });

  function prevMonth() {
    if (reportMonth === 1) { setReportMonth(12); setReportYear(reportYear - 1); }
    else setReportMonth(reportMonth - 1);
  }
  function nextMonth() {
    if (reportMonth === 12) { setReportMonth(1); setReportYear(reportYear + 1); }
    else setReportMonth(reportMonth + 1);
  }

  const { data: expenses, isLoading } = useQuery<any[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
    refetchInterval: 30_000,
  });

  const { data: report } = useQuery<any>({
    queryKey: ["expenses-report", reportMonthStr],
    queryFn: () => apiFetch(`/expenses/report?month=${reportMonthStr}`),
    enabled: tab === "report" && isAdmin,
  });

  const submitMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/expenses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Expense submitted", description: "Waiting for 2 admin approvals" });
      setForm({ amount: "", description: "", category: "other", expenseDate: new Date().toISOString().split("T")[0] });
      setShowForm(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: string; notes: string }) =>
      apiFetch(`/expenses/${id}/review`, { method: "PATCH", body: JSON.stringify({ action, reviewNotes: notes }) }),
    onSuccess: (result: any, vars) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-report"] });
      if (vars.action === "reject") {
        toast({ title: "Expense rejected", variant: "destructive" });
      } else if (result.status === "awaiting_second") {
        toast({ title: "First approval recorded", description: "Waiting for a second admin to approve." });
      } else {
        toast({ title: "Expense fully approved ✓" });
      }
      setReviewModal(null);
      setReviewNotes("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Expense deleted" });
      setDeleteModal(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; amount: number; description: string; category: string; expenseDate: string }) =>
      apiFetch(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-report"] });
      toast({ title: "Expense updated" });
      setEditModal(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const allList = expenses ?? [];
  const myList = allList.filter((e) => e.submittedBy === user?.name);
  // "pending" tab shows both stages that still need action
  const needsAction = allList.filter((e) => e.status === "pending" || e.status === "awaiting_second");
  // Expenses where current admin can act: pending (anyone), awaiting_second (different admin only)
  const actionable = needsAction.filter((e) =>
    e.status === "pending" || (e.status === "awaiting_second" && e.firstApprovedBy !== user?.name)
  );
  // Waiting for other admin (current admin already gave first approval)
  const waitingForMe = needsAction.filter((e) =>
    e.status === "awaiting_second" && e.firstApprovedBy === user?.name
  );

  const todayApproved = allList
    .filter((e) => e.status === "approved" && e.expenseDate === new Date().toISOString().split("T")[0])
    .reduce((s: number, e: any) => s + e.amount, 0);

  // Can current admin approve this expense?
  function canApprove(e: any) {
    if (e.status === "pending") return true;
    if (e.status === "awaiting_second") return e.firstApprovedBy !== user?.name;
    return false;
  }

  function ApprovalTrail({ e }: { e: any }) {
    return (
      <div className="flex items-center gap-3 mt-1">
        {/* Step 1 */}
        <div className={`flex items-center gap-1 text-xs ${e.firstApprovedBy || e.status === "approved" ? "text-green-600" : "text-muted-foreground"}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${e.firstApprovedBy ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>1</div>
          {e.firstApprovedBy ? (
            <span className="font-medium">{e.firstApprovedBy}</span>
          ) : (
            <span>Awaiting 1st</span>
          )}
        </div>
        <div className="flex-1 h-px bg-border" />
        {/* Step 2 */}
        <div className={`flex items-center gap-1 text-xs ${e.status === "approved" ? "text-green-600" : "text-muted-foreground"}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${e.status === "approved" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>2</div>
          {e.status === "approved" && e.reviewedBy ? (
            <span className="font-medium">{e.reviewedBy}</span>
          ) : (
            <span>Awaiting 2nd</span>
          )}
        </div>
      </div>
    );
  }

  function ExpenseRow({ e, showActions }: { e: any; showActions: boolean }) {
    const alreadyApprovedByMe = e.status === "awaiting_second" && e.firstApprovedBy === user?.name;

    return (
      <tr className="border-t border-border hover:bg-muted/20">
        <td className="py-3 px-3">
          <div className="font-medium text-sm leading-snug">{e.description}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{e.submittedBy} · {formatDate(e.expenseDate)}</div>
          {/* Approval trail inline */}
          {(e.status === "awaiting_second" || e.status === "approved") && (
            <ApprovalTrail e={e} />
          )}
          {e.reviewNotes && e.status === "rejected" && (
            <div className="text-xs text-red-500 mt-0.5 italic">"{e.reviewNotes}"</div>
          )}
        </td>
        <td className="py-3 px-3 hidden md:table-cell">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[e.category] ?? CAT_COLORS.other}`}>
            {catLabel(e.category)}
          </span>
        </td>
        <td className="py-3 px-3 text-right font-bold text-sm">{formatUGX(e.amount)}</td>
        <td className="py-3 px-3">
          <StatusBadge status={e.status} firstApprovedBy={e.firstApprovedBy} />
        </td>
        {showActions && (
          <td className="py-3 px-3 text-right">
            <div className="flex gap-1.5 justify-end items-center">
              {isAdmin && (e.status === "pending" || e.status === "awaiting_second") && (
                alreadyApprovedByMe ? (
                  <span className="text-xs text-blue-500 bg-blue-50 border border-blue-100 rounded px-2 py-1 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> You approved — waiting for 2nd
                  </span>
                ) : (
                  <button
                    onClick={() => { setReviewModal({ id: e.id, desc: e.description, status: e.status, firstApprovedBy: e.firstApprovedBy }); setReviewNotes(""); }}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                  >
                    {e.status === "awaiting_second" ? "Give 2nd Approval" : "Review"}
                  </button>
                )
              )}
              {(e.status === "pending" || e.status === "awaiting_second") && (isAdmin || e.submittedBy === user?.name) && (
                <button
                  onClick={() => setEditModal({ id: e.id, amount: String(e.amount), description: e.description, category: e.category, expenseDate: e.expenseDate })}
                  className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {(e.status === "pending" || e.status === "awaiting_second") && (isAdmin || e.submittedBy === user?.name) && (
                <button
                  onClick={() => setDeleteModal({ id: e.id, desc: e.description })}
                  className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Expenses
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isAdmin
              ? "Expenses require 2 different admin approvals to be finalised"
              : "Submit expenses — 2 admin approvals required before payment"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Submit Expense
        </Button>
      </div>

      {/* Dual-approval notice */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <span className="font-semibold">Two-admin approval policy</span> — Every expense must be approved by <strong>two different admins</strong> before it is considered authorised and paid. The same admin cannot approve an expense twice.
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{needsAction.filter(e => e.status === "pending").length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Awaiting 1st Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{needsAction.filter(e => e.status === "awaiting_second").length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Awaiting 2nd Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{allList.filter(e => e.status === "approved").length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Fully Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-foreground">
              {formatUGX(allList.filter(e => e.status === "approved" && e.expenseDate?.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s: number, e: any) => s + e.amount, 0))}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">This Month (Approved)</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {isAdmin && (
          <button onClick={() => setTab("pending")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            Needs Action {needsAction.length > 0 && <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs rounded-full px-1.5 py-0.5 font-bold">{needsAction.length}</span>}
          </button>
        )}
        <button onClick={() => setTab("all")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          {isAdmin ? "All Expenses" : "My Expenses"}
        </button>
        {isAdmin && (
          <button onClick={() => setTab("report")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "report" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <BarChart2 className="h-3.5 w-3.5" /> Monthly Report
          </button>
        )}
      </div>

      {/* ── PENDING / NEEDS ACTION TAB ── */}
      {tab === "pending" && isAdmin && (
        <div className="space-y-4">
          {needsAction.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No expenses waiting for approval.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Actionable by current admin */}
              {actionable.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-yellow-600" /> Your action required ({actionable.length})
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Description</th>
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actionable.map((e) => <ExpenseRow key={e.id} e={e} showActions />)}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Waiting for other admin (already approved by me) */}
              {waitingForMe.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-blue-500" /> Waiting for another admin ({waitingForMe.length})
                  </h3>
                  <Card className="opacity-70">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Description</th>
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
                              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {waitingForMe.map((e) => <ExpenseRow key={e.id} e={e} showActions />)}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ALL / MY EXPENSES TAB ── */}
      {tab === "all" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (isAdmin ? allList : myList).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No expenses yet</p>
                <p className="text-sm">Submit an expense using the button above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isAdmin ? allList : myList).map((e) => <ExpenseRow key={e.id} e={e} showActions />)}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── MONTHLY REPORT TAB ── */}
      {tab === "report" && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 justify-center">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-lg min-w-40 text-center">{reportMonthLabel}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {!report ? (
            <div className="text-center py-8 text-muted-foreground">Loading report...</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="col-span-2">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Approved Expenses</div>
                    <div className="text-3xl font-bold text-destructive">{formatUGX(report.totalApproved)}</div>
                    {report.pendingCount > 0 && (
                      <div className="text-xs text-yellow-600 mt-1">+ {report.pendingCount} pending/awaiting approval not included</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Transactions</div>
                    <div className="text-3xl font-bold">{report.entries?.length ?? 0}</div>
                  </CardContent>
                </Card>
              </div>

              {report.byCategory.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-primary" /> Breakdown by Category
                    </h3>
                    <div className="space-y-2">
                      {report.byCategory.map((c: any) => (
                        <div key={c.category} className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${CAT_COLORS[c.category] ?? CAT_COLORS.other}`}>
                            {catLabel(c.category)}
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${report.totalApproved > 0 ? Math.round((c.total / report.totalApproved) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="font-semibold text-sm shrink-0">{formatUGX(c.total)}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({c.count})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.byPerson.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Spending by Person</h3>
                    <div className="space-y-2">
                      {report.byPerson.map((p: any) => (
                        <div key={p.submittedBy} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                              {p.submittedBy.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">{p.submittedBy}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">{formatUGX(p.total)}</div>
                            <div className="text-xs text-muted-foreground">{p.count} item{p.count !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.entries?.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Full Expense Log — {reportMonthLabel}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                            <th className="text-left py-2 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                            <th className="text-left py-2 font-medium text-muted-foreground">By</th>
                            <th className="text-left py-2 font-medium text-muted-foreground hidden md:table-cell">Approvals</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.entries.map((e: any) => (
                            <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                              <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">{formatDate(e.expenseDate)}</td>
                              <td className="py-2 font-medium">{e.description}</td>
                              <td className="py-2 hidden md:table-cell">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${CAT_COLORS[e.category] ?? CAT_COLORS.other}`}>
                                  {catLabel(e.category)}
                                </span>
                              </td>
                              <td className="py-2 text-sm text-muted-foreground">{e.submittedBy}</td>
                              <td className="py-2 hidden md:table-cell">
                                <div className="text-xs text-muted-foreground">
                                  <div>1st: {e.firstApprovedBy ?? "—"}</div>
                                  <div>2nd: {e.reviewedBy ?? "—"}</div>
                                </div>
                              </td>
                              <td className="py-2 text-right font-semibold">{formatUGX(e.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-border font-bold bg-muted/30">
                            <td colSpan={5} className="py-2.5 px-0 text-sm">Total</td>
                            <td className="py-2.5 text-right text-destructive">{formatUGX(report.totalApproved)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.entries?.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No approved expenses recorded for {reportMonthLabel}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Submit Expense Dialog ── */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) setForm({ amount: "", description: "", category: "other", expenseDate: new Date().toISOString().split("T")[0] }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Submit Expense
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitMutation.mutate({ amount: Number(form.amount), description: form.description, category: form.category, expenseDate: form.expenseDate }); }} className="space-y-4">
            <div>
              <Label>What was spent on?</Label>
              <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Bought 10kg sugar from market" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (UGX)</Label>
                <Input className="mt-1" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" required />
              </div>
              <div>
                <Label>Date</Label>
                <Input className="mt-1" type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              This expense will require approval from 2 different admins before it is authorised.
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? "Submitting…" : "Submit Expense"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ── */}
      {reviewModal && (
        <Dialog open onOpenChange={() => { setReviewModal(null); setReviewNotes(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {reviewModal.status === "awaiting_second" ? "Give 2nd Approval" : "Review Expense"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{reviewModal.desc}</span>
              </p>

              {/* Approval context */}
              <div className="rounded-lg border border-border p-3 text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${reviewModal.firstApprovedBy ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>1</div>
                  <span className="text-muted-foreground">1st approval:</span>
                  <span className="font-medium">{reviewModal.firstApprovedBy ?? "Not yet given"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">2</div>
                  <span className="text-muted-foreground">2nd approval:</span>
                  <span className="font-medium text-primary">You ({user?.name})</span>
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Input className="mt-1" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Any notes about this expense..." />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => reviewMutation.mutate({ id: reviewModal.id, action: "approve", notes: reviewNotes })}
                  disabled={reviewMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {reviewModal.status === "awaiting_second" ? "Fully Approve" : "1st Approval"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => reviewMutation.mutate({ id: reviewModal.id, action: "reject", notes: reviewNotes })}
                  disabled={reviewMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1.5" /> Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Expense Dialog ── */}
      {editModal && (
        <Dialog open onOpenChange={() => setEditModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" /> Edit Expense
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate({ id: editModal.id, amount: Number(editModal.amount), description: editModal.description, category: editModal.category, expenseDate: editModal.expenseDate });
              }}
              className="space-y-4"
            >
              <div>
                <Label>What was spent on?</Label>
                <Input className="mt-1" value={editModal.description} onChange={(e) => setEditModal({ ...editModal, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (UGX)</Label>
                  <Input className="mt-1" type="number" min="1" value={editModal.amount} onChange={(e) => setEditModal({ ...editModal, amount: e.target.value })} required />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input className="mt-1" type="date" value={editModal.expenseDate} onChange={(e) => setEditModal({ ...editModal, expenseDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editModal.category} onValueChange={(v) => setEditModal({ ...editModal, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirm Dialog ── */}
      {deleteModal && (
        <Dialog open onOpenChange={() => setDeleteModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Expense?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>"{deleteModal.desc}"</strong>? This cannot be undone.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteModal.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
