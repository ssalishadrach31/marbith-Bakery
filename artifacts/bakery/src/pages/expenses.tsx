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
} from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
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

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-600 border-red-200",
};

function catLabel(c: string) { return CATEGORIES.find((x) => x.value === c)?.label ?? c; }

export default function ExpensesPage() {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"pending" | "all" | "report">(isAdmin ? "pending" : "all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", description: "", category: "other", expenseDate: new Date().toISOString().split("T")[0] });
  const [reviewModal, setReviewModal] = useState<{ id: number; desc: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ id: number; desc: string } | null>(null);

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
      toast({ title: "Expense submitted", description: "Waiting for admin approval" });
      setForm({ amount: "", description: "", category: "other", expenseDate: new Date().toISOString().split("T")[0] });
      setShowForm(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes: string }) =>
      apiFetch(`/expenses/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, reviewNotes: notes }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-report"] });
      toast({ title: vars.status === "approved" ? "Expense approved ✓" : "Expense rejected", variant: vars.status === "approved" ? "default" : "destructive" });
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

  const pending = (expenses ?? []).filter((e) => e.status === "pending");
  const allList = (expenses ?? []);
  const myList = allList.filter((e) => e.submittedBy === user?.name);

  const todayApproved = (expenses ?? [])
    .filter((e) => e.status === "approved" && e.expenseDate === new Date().toISOString().split("T")[0])
    .reduce((s: number, e: any) => s + e.amount, 0);

  function ExpenseRow({ e, showActions }: { e: any; showActions: boolean }) {
    return (
      <tr className="border-t border-border hover:bg-muted/20">
        <td className="py-3 px-3">
          <div className="font-medium text-sm leading-snug">{e.description}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{e.submittedBy} · {formatDate(e.expenseDate)}</div>
        </td>
        <td className="py-3 px-3 hidden md:table-cell">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[e.category] ?? CAT_COLORS.other}`}>
            {catLabel(e.category)}
          </span>
        </td>
        <td className="py-3 px-3 text-right font-bold text-sm">{formatUGX(e.amount)}</td>
        <td className="py-3 px-3 text-center">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[e.status]}`}>
            {e.status === "pending" ? "Pending" : e.status === "approved" ? "Approved" : "Rejected"}
          </span>
        </td>
        {showActions && (
          <td className="py-3 px-3 text-right">
            <div className="flex gap-1.5 justify-end">
              {isAdmin && e.status === "pending" && (
                <button
                  onClick={() => { setReviewModal({ id: e.id, desc: e.description }); setReviewNotes(""); }}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  Review
                </button>
              )}
              {e.status === "pending" && (isAdmin || e.submittedBy === user?.name) && (
                <button
                  onClick={() => setDeleteModal({ id: e.id, desc: e.description })}
                  className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {e.reviewNotes && (
                <span className="text-xs text-muted-foreground italic self-center max-w-32 truncate" title={e.reviewNotes}>
                  "{e.reviewNotes}"
                </span>
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
            {isAdmin ? "Review staff expenses and track spending" : "Submit expenses for admin approval"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Submit Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pending.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {(expenses ?? []).filter((e) => e.status === "approved").length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{formatUGX(todayApproved)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Expenses Today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-foreground">
              {formatUGX((expenses ?? []).filter((e) => e.status === "approved" && e.expenseDate?.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s: number, e: any) => s + e.amount, 0))}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">This Month</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {isAdmin && (
          <button onClick={() => setTab("pending")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            Pending {pending.length > 0 && <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs rounded-full px-1.5 py-0.5 font-bold">{pending.length}</span>}
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

      {/* ── PENDING TAB ── */}
      {tab === "pending" && isAdmin && (
        <Card>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No expenses waiting for approval.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((e) => <ExpenseRow key={e.id} e={e} showActions />)}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
                      <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Status</th>
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
          {/* Month picker */}
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
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="col-span-2">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Approved Expenses</div>
                    <div className="text-3xl font-bold text-destructive">{formatUGX(report.totalApproved)}</div>
                    {report.pendingCount > 0 && (
                      <div className="text-xs text-yellow-600 mt-1">+ {report.pendingCount} pending not yet included</div>
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

              {/* By category */}
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

              {/* By person */}
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

              {/* Full list */}
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
                              <td className="py-2 text-right font-semibold">{formatUGX(e.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-border font-bold bg-muted/30">
                            <td colSpan={4} className="py-2.5 px-0 text-sm">Total</td>
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

      {/* Submit Expense Dialog */}
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
                <Input className="mt-1" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 50000" required />
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
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              This will be sent to the admin for approval before it affects any reports.
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewModal} onOpenChange={(v) => { if (!v) { setReviewModal(null); setReviewNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review Expense</DialogTitle>
          </DialogHeader>
          {reviewModal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">"{reviewModal.desc}"</p>
              <div>
                <Label>Notes (optional)</Label>
                <Input className="mt-1" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Reason for rejection, or leave blank" />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: reviewModal.id, status: "approved", notes: reviewNotes })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: reviewModal.id, status: "rejected", notes: reviewNotes })}
                >
                  <XCircle className="h-4 w-4 mr-1.5" /> Reject
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setReviewModal(null); setReviewNotes(""); }}>Cancel</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteModal} onOpenChange={(v) => { if (!v) setDeleteModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Expense?</DialogTitle>
          </DialogHeader>
          {deleteModal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Are you sure you want to delete this expense?</p>
              <p className="text-sm font-medium bg-muted/40 rounded-lg p-3">"{deleteModal.desc}"</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteModal(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteModal.id)}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
