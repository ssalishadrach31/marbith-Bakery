import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser, formatUGX, formatTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Factory, ShoppingCart, Package, Wallet,
  Clock, RefreshCw, CheckCircle2,
  Truck, ChevronRight, Plus, Users,
  IceCream, Coffee, Droplets, ChevronLeft, GlassWater,
  CalendarDays, ArrowRight, ChevronDown,
  History, MoonStar, X, AlertCircle, Banknote, Sunrise, Pencil, Milk,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); const err: any = new Error(e.error ?? "Request failed"); err.status = res.status; throw err; }
  return res.status === 204 ? null : res.json();
}

function StepBadge({ n, label, done, onClick }: { n: number; label: string; done: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${done ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="w-4 h-4 flex items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-bold">{n}</span>}
      {label}
    </button>
  );
}

type CountEntry = {
  productId: number;
  productName: string;
  price: number;
  category: string;
  opening?: number;
  closing?: number;
  openingBy?: string;
  closingBy?: string;
};

function CountSection({
  title,
  icon,
  entries,
  color,
  onSave,
  isSaving,
}: {
  title: string;
  icon: React.ReactNode;
  entries: CountEntry[];
  color: string;
  onSave: (productId: number, countType: "opening" | "closing", quantity: number) => void;
  isSaving: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  function saveEntry(productId: number, countType: "opening" | "closing", key: string) {
    const q = parseInt(drafts[key] ?? "");
    if (!isNaN(q) && q >= 0) {
      onSave(productId, countType, q);
      setDrafts((d) => { const nd = { ...d }; delete nd[key]; return nd; });
    }
  }

  // Build effective values: saved data takes priority; fall back to typed draft for live preview
  const effectiveEntries = entries.map((e) => {
    const openKey = `${e.productId}-opening`;
    const closeKey = `${e.productId}-closing`;
    const draftOpen = parseInt(drafts[openKey] ?? "");
    const draftClose = parseInt(drafts[closeKey] ?? "");
    const effOpen = e.opening !== undefined ? e.opening : (!isNaN(draftOpen) && drafts[openKey] !== undefined ? draftOpen : undefined);
    const effClose = e.closing !== undefined ? e.closing : (!isNaN(draftClose) && drafts[closeKey] !== undefined ? draftClose : undefined);
    return { ...e, effOpen, effClose, openKey, closeKey };
  });

  const totalSold = effectiveEntries.reduce((s, e) => {
    if (e.effOpen === undefined || e.effClose === undefined) return s;
    return s + Math.max(0, e.effOpen - e.effClose);
  }, 0);
  const totalRevenue = effectiveEntries.reduce((s, e) => {
    if (e.effOpen === undefined || e.effClose === undefined) return s;
    return s + Math.max(0, e.effOpen - e.effClose) * e.price;
  }, 0);

  const allComplete = effectiveEntries.length > 0 && effectiveEntries.every((e) => e.effOpen !== undefined && e.effClose !== undefined);
  const hasOpening = effectiveEntries.some((e) => e.effOpen !== undefined);
  const hasClosing = effectiveEntries.some((e) => e.effClose !== undefined);

  return (
    <Card>
      <CardContent className="p-5">
        <button className="w-full flex items-center gap-2 mb-2 text-left" onClick={() => setIsCollapsed((c) => !c)}>
          <span className={`text-${color}-600`}>{icon}</span>
          <h2 className="font-semibold">{title}</h2>
          <div className="ml-auto flex gap-3 text-sm items-center">
            {allComplete ? (
              <>
                <span className="text-muted-foreground">Sold: <span className="font-bold text-foreground">{totalSold}</span></span>
                <span className={`font-bold text-${color}-700`}>{formatUGX(totalRevenue)}</span>
              </>
            ) : hasOpening && !hasClosing ? (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Opening set — enter closing
              </span>
            ) : !hasOpening ? (
              <span className="text-xs text-muted-foreground">Enter opening count to begin</span>
            ) : (
              <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">Partial counts</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
        </button>

        {!isCollapsed && <>
        {/* Progress bar */}
        {entries.length > 0 && (
          <div className="flex gap-1 mb-4">
            {effectiveEntries.map((e) => {
              const bothDone = e.effOpen !== undefined && e.effClose !== undefined;
              const onlyOpen = e.effOpen !== undefined && e.effClose === undefined;
              return (
                <div
                  key={e.productId}
                  className={`flex-1 h-1.5 rounded-full ${bothDone ? `bg-${color}-400` : onlyOpen ? "bg-blue-300" : "bg-muted"}`}
                  title={e.productName}
                />
              );
            })}
          </div>
        )}

        <div className="overflow-auto max-h-[55vh] overscroll-contain rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Item</th>
                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Price</th>
                <th className="text-center py-2.5 px-3 font-medium text-blue-600">Opening</th>
                <th className="text-center py-2.5 px-3 font-medium text-purple-600">Closing</th>
                <th className="text-center py-2.5 px-3 font-medium text-green-600">Sold</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {effectiveEntries.map((entry) => {
                const { openKey, closeKey, effOpen, effClose } = entry;
                const sold = effOpen !== undefined && effClose !== undefined
                  ? Math.max(0, effOpen - effClose)
                  : null;
                const revenue = sold !== null ? sold * entry.price : null;
                const isPreview = sold !== null && (entry.opening === undefined || entry.closing === undefined);

                return (
                  <tr key={entry.productId} className="border-t border-border hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-medium">{entry.productName}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{formatUGX(entry.price)}</td>

                    {/* Opening count — drafts take priority so re-edit works */}
                    <td className="py-2 px-2 text-center">
                      {drafts[openKey] !== undefined ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-16 text-center text-sm p-1"
                            value={drafts[openKey]}
                            onChange={(e) => setDrafts((d) => ({ ...d, [openKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEntry(entry.productId, "opening", openKey); }}
                            autoFocus
                          />
                          <button
                            className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded font-bold text-base"
                            disabled={isSaving}
                            onClick={() => saveEntry(entry.productId, "opening", openKey)}
                          >✓</button>
                        </div>
                      ) : entry.opening !== undefined ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-blue-700 text-base">{entry.opening}</span>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground ml-1"
                            onClick={() => setDrafts((d) => ({ ...d, [openKey]: String(entry.opening) }))}
                          >✎</button>
                        </div>
                      ) : (
                        <button
                          className="text-xs border border-dashed border-blue-300 text-blue-500 rounded px-2 py-1 hover:bg-blue-50"
                          onClick={() => setDrafts((d) => ({ ...d, [openKey]: "" }))}
                        >Enter</button>
                      )}
                    </td>

                    {/* Closing count — drafts take priority so re-edit works */}
                    <td className="py-2 px-2 text-center">
                      {drafts[closeKey] !== undefined ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-16 text-center text-sm p-1"
                            value={drafts[closeKey]}
                            onChange={(e) => setDrafts((d) => ({ ...d, [closeKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEntry(entry.productId, "closing", closeKey); }}
                            autoFocus
                          />
                          <button
                            className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded font-bold text-base"
                            disabled={isSaving}
                            onClick={() => saveEntry(entry.productId, "closing", closeKey)}
                          >✓</button>
                        </div>
                      ) : entry.closing !== undefined ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-purple-700 text-base">{entry.closing}</span>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground ml-1"
                            onClick={() => setDrafts((d) => ({ ...d, [closeKey]: String(entry.closing) }))}
                          >✎</button>
                        </div>
                      ) : (
                        <button
                          className="text-xs border border-dashed border-purple-300 text-purple-500 rounded px-2 py-1 hover:bg-purple-50"
                          onClick={() => setDrafts((d) => ({ ...d, [closeKey]: "" }))}
                        >Enter</button>
                      )}
                    </td>

                    {/* Sold */}
                    <td className="py-2.5 px-3 text-center">
                      {sold !== null ? (
                        <span className={`font-bold text-base ${isPreview ? "text-green-500" : sold === 0 ? "text-muted-foreground" : "text-green-700"}`}>{sold}</span>
                      ) : effOpen !== undefined && effClose === undefined ? (
                        <span className="text-xs text-blue-500 flex items-center justify-center gap-0.5">
                          <ArrowRight className="h-3 w-3" /> closing?
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Revenue */}
                    <td className="py-2.5 px-3 text-right font-semibold">
                      {revenue !== null ? (
                        <span className={isPreview ? "text-green-500 font-bold" : revenue === 0 ? "text-muted-foreground" : "text-green-700 font-bold"}>{formatUGX(revenue)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td colSpan={4} className="py-2.5 px-3 text-sm">Total</td>
                <td className="py-2.5 px-3 text-center text-green-700">{totalSold}</td>
                <td className="py-2.5 px-3 text-right text-primary">{formatUGX(totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-blue-300 inline-block" /> Opening set</span>
          <span className="flex items-center gap-1"><span className={`w-3 h-1.5 rounded-full bg-${color}-400 inline-block`} /> Both set (sold calculated)</span>
          <span className="ml-auto">Click ✎ to edit an existing count.</span>
        </div>
        </>}
      </CardContent>
    </Card>
  );
}

const DRINK_PRODUCTS = [
  "Jesa Milk Flavored","Jesa Sachet","Fresh Dairy Tin","Jesa Milk","Probiotic Tin",
  "Soda 330ml","Soda 500ml","Onner","Minute Maid","Minute Maid Big",
  "Rockboom","Predator","Sting","Energy","Coffee Malt","Nkoge","Tamarind","Bongo",
];

export default function StaffDashboardPage() {
  const user = getUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const role = user?.role;
  const showProduction = role === "admin" || role === "staff" || role === "baker";
  const showSales = role === "admin" || role === "staff" || role === "cashier";

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => apiFetch("/staff-dashboard"),
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

  // Products, inventory, daily counts, shift closings, new-day request and
  // self-attendance all come bundled in the single staff-dashboard response —
  // no extra round trips needed.
  const products: any[] = data?.products ?? [];
  const fullInventory: any[] = data?.inventory ?? [];

  const todayStr = new Date().toISOString().split("T")[0];
  const [countsDate, setCountsDate] = useState(todayStr);

  function prevCountDay() {
    const d = new Date(countsDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setCountsDate(d.toISOString().split("T")[0]);
  }
  function nextCountDay() {
    const d = new Date(countsDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    if (d.toISOString().split("T")[0] <= todayStr) setCountsDate(d.toISOString().split("T")[0]);
  }
  const isToday = countsDate === todayStr;
  const countsDateLabel = isToday
    ? "Today"
    : new Date(countsDate + "T12:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short" });

  // For today: use bundled data. For past dates: fetch separately.
  const { data: historicalCounts } = useQuery<any[]>({
    queryKey: ["daily-counts", countsDate],
    queryFn: () => apiFetch(`/daily-counts?date=${countsDate}`),
    enabled: !isToday,
    staleTime: 60_000,
  });
  const dailyCounts: any[] = isToday ? (data?.dailyCounts ?? []) : (historicalCounts ?? []);

  const refetchFullInventory = refetch;
  const [drinkStockDialog, setDrinkStockDialog] = useState<{ productId: number; productName: string } | null>(null);
  const [drinkStockQty, setDrinkStockQty] = useState("");
  const [drinkStockNote, setDrinkStockNote] = useState("");

  // Cashier daily pay (admin only)
  const { data: dailyPayData = [], refetch: refetchDailyPay } = useQuery<any[]>({
    queryKey: ["daily-pay", todayStr],
    queryFn: () => apiFetch(`/daily-pay?date=${todayStr}`),
    enabled: user?.role === "admin",
    staleTime: 30_000,
  });
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
  const submitPayMutation = useMutation({
    mutationFn: ({ name, amount }: { name: string; amount: number }) =>
      apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          amount,
          description: `Daily salary for ${name} - ${todayStr}`,
          category: "daily_salary",
          expenseDate: todayStr,
        }),
      }),
    onSuccess: (_data, vars) => {
      refetchDailyPay();
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Pay submitted", description: `Salary for ${vars.name} sent for approval.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Self check-in / check-out — uses bundled selfAttendance from dashboard ──
  const selfAttendance: any = data?.selfAttendance ?? null;
  const selfCheckInMutation = useMutation({
    mutationFn: () => apiFetch("/attendance/self-check-in", { method: "POST" }),
    onSuccess: () => { refetch(); toast({ title: "Checked In", description: "You have successfully checked in." }); },
    onError: (e: any) => toast({ title: "Check-in failed", description: e.message, variant: "destructive" }),
  });
  const selfCheckOutMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/attendance/self-check-out/${id}`, { method: "PUT" }),
    onSuccess: (res: any) => {
      refetch();
      const hrs = res?.hoursWorked ? `${Number(res.hoursWorked).toFixed(1)} hrs worked` : "";
      toast({ title: "Checked Out", description: `You have checked out.${hrs ? " " + hrs : ""}` });
    },
    onError: (e: any) => toast({ title: "Check-out failed", description: e.message, variant: "destructive" }),
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  function toggleSection(id: string) { setCollapsed((c) => ({ ...c, [id]: !c[id] })); }
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else toggleSection(id);
  }

  // ── Shift Closing ─────────────────────────────────────────────────────────
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewDayDialog, setShowNewDayDialog] = useState(false);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: yesterdayClosingCounts } = useQuery<any[]>({
    queryKey: ["daily-counts", yesterdayStr],
    queryFn: () => apiFetch(`/daily-counts?date=${yesterdayStr}`),
    enabled: showNewDayDialog,
    staleTime: 60_000,
  });

  const carryForwardMutation = useMutation({
    mutationFn: () => apiFetch("/daily-counts/carry-forward", {
      method: "POST",
      body: JSON.stringify({ fromDate: yesterdayStr, toDate: todayStr }),
    }),
    onSuccess: (res: any) => {
      refetch();
      setShowNewDayDialog(false);
      toast({ title: "New Day Started!", description: res.message ?? "Opening stock carried forward from yesterday." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Shift closings and new-day request come bundled from the dashboard response
  const shiftClosings: any[] = data?.shiftClosings ?? [];
  const newDayRequest: any = data?.newDayRequest ?? null;

  const requestNewDayMutation = useMutation({
    mutationFn: () => apiFetch("/daily-counts/new-day-request", {
      method: "POST",
      body: JSON.stringify({ fromDate: yesterdayStr, toDate: todayStr }),
    }),
    onSuccess: () => {
      refetch();
      setShowNewDayDialog(false);
      toast({ title: "Request Sent!", description: "Your request to start a new day has been sent to admin for approval." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveNewDayMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiFetch(`/daily-counts/new-day-request/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
    onSuccess: (res: any) => {
      refetch();
      if (res.rejected) {
        toast({ title: "Request Rejected", description: "The new day request has been rejected." });
      } else {
        toast({ title: "New Day Approved!", description: res.message });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const todayClosing = (shiftClosings ?? []).find((c: any) => c.shiftDate === todayStr);
  const yesterdayClosing = (shiftClosings ?? []).find((c: any) => c.shiftDate === yesterdayStr && c.status === "approved");
  const isAdmin = role === "admin";
  const isTodayClosed = todayClosing?.status === "approved";
  const isPendingClose = todayClosing?.status === "pending";
  const todayHasOpenings = (dailyCounts ?? []).some((c: any) => c.countType === "opening");
  const hasPendingNewDayRequest = newDayRequest?.status === "pending";
  const hasApprovedNewDayRequest = newDayRequest?.status === "approved";
  // Prompt shows when yesterday is approved, today has no openings, and day is not yet closed
  // For non-admins: suppress once they've submitted a request (show the "pending" state instead)
  const showNewDayPrompt = !!yesterdayClosing && !todayHasOpenings && !isTodayClosed && !isPendingClose && !hasApprovedNewDayRequest && (isAdmin || !hasPendingNewDayRequest);

  const closeDayMutation = useMutation({
    mutationFn: () => apiFetch("/shift-closings", { method: "POST", body: JSON.stringify({ shiftDate: todayStr }) }),
    onSuccess: () => {
      refetch();
      setShowCloseConfirm(false);
      if (role === "admin") {
        toast({ title: "Day Closed", description: `Shift for ${today} has been marked as closed.` });
      } else {
        toast({ title: "Request Sent", description: "Your close day request has been sent to admin for review." });
      }
    },
    onError: (err: any) => {
      setShowCloseConfirm(false);
      refetch();
      if (err.message?.includes("already been closed")) {
        toast({ title: "Already Closed", description: "Today's shift was already closed by another admin. Only one closing per day is allowed.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const approveCloseMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiFetch(`/shift-closings/${id}/approve`, { method: "PATCH", body: JSON.stringify({ action }) }),
    onSuccess: (res: any) => {
      refetch();
      if (res.deleted) {
        toast({ title: "Request Rejected", description: "The close day request has been rejected." });
      } else {
        toast({ title: "Day Closed & Approved", description: "Today's shift has been officially closed." });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: shiftHistory, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["shift-history"],
    queryFn: () => apiFetch("/reports/shift-history?days=30"),
    enabled: showHistory,
    staleTime: 60_000,
  });

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  function toggleHistoryDay(date: string) { setExpandedDays((d) => ({ ...d, [date]: !d[date] })); }

  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ productId: "", quantityReceived: "", notes: "" });

  const addReceiptMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/shop-receipts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
      toast({ title: "Receipt confirmed", description: `${result.quantityReceived} × ${result.productName} received` });
      setReceiptForm({ productId: "", quantityReceived: "", notes: "" });
      setShowReceiptForm(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveCountMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/daily-counts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (result: any) => {
      // Immediately update the local cache so sold/total shows without waiting for a refetch
      qc.setQueryData(["daily-counts", result.countDate ?? countsDate], (old: any[] | undefined) => {
        const filtered = (old ?? []).filter(
          (c: any) => !(c.productId === result.productId && c.countType === result.countType)
        );
        return [...filtered, result];
      });
      // Background refetch for consistency + refresh admin dashboard revenue
      qc.invalidateQueries({ queryKey: ["daily-counts", result.countDate ?? countsDate] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Count saved", description: `${result.countType === "opening" ? "Opening" : "Closing"}: ${result.quantity} × ${result.productName}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSaveCount(productId: number, countType: "opening" | "closing", quantity: number) {
    saveCountMutation.mutate({ productId, countType, quantity, countDate: countsDate });
  }

  const adjustDrinkMutation = useMutation({
    mutationFn: ({ productId, quantity, reason }: { productId: number; quantity: number; reason: string }) =>
      apiFetch(`/inventory/${productId}/adjust`, { method: "POST", body: JSON.stringify({ quantity, reason }) }),
    onSuccess: (result: any) => {
      refetchFullInventory();
      qc.invalidateQueries({ queryKey: ["full-inventory"] });
      toast({ title: "Stock Updated", description: `${result.productName}: now ${result.currentStock} in stock` });
      setDrinkStockDialog(null);
      setDrinkStockQty("");
      setDrinkStockNote("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Edit production entry ──────────────────────────────────────────────────
  type EditProdState = { id: number; productName: string; entryType: string; quantity: string; notes: string };
  const [editProd, setEditProd] = useState<EditProdState | null>(null);
  const editProdMutation = useMutation({
    mutationFn: ({ id, ...body }: EditProdState) =>
      apiFetch(`/production/${id}`, { method: "PATCH", body: JSON.stringify({ quantity: parseInt(body.quantity), entryType: body.entryType, notes: body.notes || null }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
      toast({ title: "Production entry updated" });
      setEditProd(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Edit receipt entry ─────────────────────────────────────────────────────
  type EditReceiptState = { id: number; productName: string; quantityReceived: string; notes: string };
  const [editReceipt, setEditReceipt] = useState<EditReceiptState | null>(null);
  const editReceiptMutation = useMutation({
    mutationFn: ({ id, ...body }: EditReceiptState) =>
      apiFetch(`/shop-receipts/${id}`, { method: "PATCH", body: JSON.stringify({ quantityReceived: parseInt(body.quantityReceived), notes: body.notes || null }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
      toast({ title: "Receipt entry updated" });
      setEditReceipt(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-muted-foreground">Could not load dashboard. The server may be waking up.</p>
      <button
        onClick={() => refetch()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );

  const { production, receipts, sales, inventory, accountability, expenses } = data;
  const hasProduction = production.totalUnits > 0;
  const hasReceipts = receipts.totalReceived > 0;
  const hasSales = sales.transactionCount > 0;

  // Build per-product accountability (received vs sold vs remaining)
  const productMap: Record<number, { name: string; received: number; sold: number; remaining: number; price: number }> = {};
  receipts.byProduct.forEach((r: any) => {
    productMap[r.productId] = { name: r.productName, received: r.totalReceived, sold: 0, remaining: 0, price: r.price ?? 0 };
  });
  sales.byProduct.forEach((s: any) => {
    if (productMap[s.productId]) productMap[s.productId].sold = s.qtySold;
  });
  inventory.forEach((i: any) => {
    if (productMap[i.productId]) productMap[i.productId].remaining = i.currentStock;
  });
  const accountabilityRows = Object.entries(productMap).map(([, v]) => v);

  // Build count entries for ice cream and juice from dailyCounts
  function buildCountEntries(category: string): CountEntry[] {
    const catProducts = (products ?? []).filter((p: any) => p.category === category && p.isActive);
    return catProducts.map((p: any) => {
      const openRow = (dailyCounts ?? []).find((c: any) => c.productId === p.id && c.countType === "opening");
      const closeRow = (dailyCounts ?? []).find((c: any) => c.productId === p.id && c.countType === "closing");
      return {
        productId: p.id,
        productName: p.name,
        price: p.price,
        category,
        opening: openRow?.quantity,
        closing: closeRow?.quantity,
        openingBy: openRow?.recordedBy,
        closingBy: closeRow?.recordedBy,
      };
    });
  }

  const iceCreamEntries = buildCountEntries("ice_cream");
  const juiceEntries = buildCountEntries("juice");
  const coffeeEntries = buildCountEntries("coffee");
  const teaEntries = buildCountEntries("tea");
  const drinkEntries = buildCountEntries("drink");

  // Drinks sold today via POS (includes both sodas and milk)
  const drinksSoldToday = sales.byProduct.filter((p: any) =>
    (products ?? []).find((pr: any) => pr.id === p.productId && ["drink", "milk"].includes(pr.category))
  );
  const drinkRevenue = drinksSoldToday.reduce((s: number, p: any) => s + (p.revenue ?? 0), 0);

  // Daily counts total revenue
  const calcRevenue = (entries: CountEntry[]) =>
    entries.reduce((s, e) => {
      const sold = e.opening !== undefined && e.closing !== undefined ? Math.max(0, e.opening - e.closing) : 0;
      return s + sold * e.price;
    }, 0);

  const iceCreamRevenue = calcRevenue(iceCreamEntries);
  const juiceRevenue = calcRevenue(juiceEntries);
  const coffeeRevenue = calcRevenue(coffeeEntries);
  const teaRevenue = calcRevenue(teaEntries);
  const drinkCountRevenue = calcRevenue(drinkEntries);
  function buildDrinkStock(category: string) {
    return (products ?? []).filter((p: any) => p.category === category && p.isActive).map((p: any) => {
      const inv = (fullInventory ?? []).find((i: any) => i.productId === p.id);
      return {
        productId: p.id as number,
        productName: p.name as string,
        price: p.price as number,
        currentStock: (inv?.currentStock ?? 0) as number,
        lowStockThreshold: (p.lowStockThreshold ?? 5) as number,
        isLow: ((inv?.currentStock ?? 0) as number) <= ((p.lowStockThreshold ?? 5) as number),
      };
    });
  }
  const sodaStock = buildDrinkStock("drink");
  const milkStock = buildDrinkStock("milk");
  const drinkStock = [...sodaStock, ...milkStock];
  const drinkProducts = drinkStock; // keep for compatibility
  const lowDrinkCount = drinkStock.filter((d) => d.isLow).length;
  const approvedExpensesTotal = expenses?.approvedTotal ?? 0;
  const pendingExpensesByPerson: Array<{ submittedBy: string; total: number; count: number }> = expenses?.pendingByPerson ?? [];
  const grandTotal = sales.totalRevenue + iceCreamRevenue + juiceRevenue + coffeeRevenue + teaRevenue - approvedExpensesTotal;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Shift Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {today}
          </p>
        </div>
        <button
          onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["daily-counts"] }); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* User banner */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-sm">{user?.name} {user?.jobTitle && <span className="text-xs font-normal text-muted-foreground ml-1">· {user.jobTitle}</span>}</div>
          <div className="text-xs text-muted-foreground">Logged in today</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Grand Total Today</div>
          <div className="font-bold text-primary text-lg">{formatUGX(grandTotal)}</div>
        </div>
      </div>

      {/* Check-in / Check-out widget */}
      {(() => {
        const checkedIn = !!selfAttendance;
        const checkedOut = !!selfAttendance?.checkOut;
        const fmt12 = (iso: string) => new Date(iso).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit", hour12: true });
        const hrs = selfAttendance?.hoursWorked ? `${Number(selfAttendance.hoursWorked).toFixed(1)} hrs` : null;
        if (!checkedIn) return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
            <Sunrise className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Not checked in yet</p>
              <p className="text-xs text-amber-600">Tap the button to record your arrival time</p>
            </div>
            <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => selfCheckInMutation.mutate()} disabled={selfCheckInMutation.isPending}>
              {selfCheckInMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sunrise className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Check In</span>
            </Button>
          </div>
        );
        if (checkedIn && !checkedOut) return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Checked in at {fmt12(selfAttendance.checkIn)}</p>
              <p className="text-xs text-green-600">Shift in progress — tap to check out when done</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => selfCheckOutMutation.mutate(selfAttendance.id)} disabled={selfCheckOutMutation.isPending}>
              {selfCheckOutMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MoonStar className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Check Out</span>
            </Button>
          </div>
        );
        return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
            <CheckCircle2 className="h-5 w-5 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">Shift complete</p>
              <p className="text-xs text-slate-500">
                In {fmt12(selfAttendance.checkIn)} · Out {fmt12(selfAttendance.checkOut)}{hrs ? ` · ${hrs}` : ""}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Closed-day / pending banner */}
      {(isTodayClosed || isPendingClose) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isTodayClosed ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {isTodayClosed
            ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            : <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            {isTodayClosed ? (
              <>
                <span className="font-semibold text-sm">Day Closed</span>
                <span className="text-xs text-green-700 ml-2">
                  Closed by {todayClosing.closedBy} at {new Date(todayClosing.closedAt).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
                  {todayClosing.approvedBy && ` · Approved by ${todayClosing.approvedBy}`}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-sm">Close Day — Awaiting Admin Approval</span>
                <span className="text-xs text-amber-700 ml-2">Requested by {todayClosing.closedBy}</span>
              </>
            )}
          </div>
          <button onClick={() => setShowHistory(true)} className={`text-xs underline shrink-0 ${isTodayClosed ? "text-green-700" : "text-amber-700"}`}>View History</button>
        </div>
      )}

      {/* Start New Day — prompt when yesterday is approved & today has no opening counts */}
      {showNewDayPrompt && !showNewDayDialog && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-300 bg-blue-50">
          <Sunrise className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-blue-900">Yesterday's shift was approved.</span>
            <span className="text-xs text-blue-700 ml-2">
              {isAdmin ? "Carry forward yesterday's closing stock as today's opening counts." : "Ask admin to open today's shift by carrying forward yesterday's closing stock."}
            </span>
          </div>
          <Button size="sm" onClick={() => setShowNewDayDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            <Sunrise className="h-4 w-4 mr-1.5" /> {isAdmin ? "Start New Day" : "Request New Day"}
          </Button>
        </div>
      )}

      {/* Non-admin: pending new day request — waiting for admin approval */}
      {!isAdmin && hasPendingNewDayRequest && !todayHasOpenings && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50">
          <Sunrise className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-amber-900">New Day Request Sent</span>
            <span className="text-xs text-amber-700 ml-2">Waiting for admin to approve and open today's shift. You'll be notified once it's confirmed.</span>
          </div>
        </div>
      )}

      {/* Admin: pending new day request from staff — approve or reject */}
      {isAdmin && hasPendingNewDayRequest && !todayHasOpenings && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-300 bg-indigo-50">
          <Sunrise className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-indigo-900">New Day Request — Admin Action Required</span>
            <span className="text-xs text-indigo-700 ml-2">
              {newDayRequest?.requested_by} is requesting to carry forward closing stock from {newDayRequest?.from_date} as today's opening.
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => approveNewDayMutation.mutate({ id: newDayRequest.id, action: "approve" })}
              disabled={approveNewDayMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => approveNewDayMutation.mutate({ id: newDayRequest.id, action: "reject" })}
              disabled={approveNewDayMutation.isPending}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Start New Day dialog — shows yesterday's closing stock */}
      {showNewDayDialog && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sunrise className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-sm">Start New Day — Carry Forward Stock</h3>
              </div>
              <button onClick={() => setShowNewDayDialog(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Yesterday ({yesterdayStr}) was closed and approved. Click below to set yesterday's closing stock as today's opening counts automatically.
            </p>

            {/* Yesterday's closing counts table */}
            {yesterdayClosingCounts === undefined ? (
              <div className="h-14 bg-muted rounded-lg animate-pulse" />
            ) : (() => {
              const closing = yesterdayClosingCounts.filter((c: any) => c.countType === "closing");
              if (closing.length === 0) return (
                <p className="text-sm text-muted-foreground text-center py-3">No closing counts recorded for yesterday.</p>
              );
              return (
                <div className="overflow-x-auto rounded-lg border border-blue-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-blue-100/60 border-b border-blue-200">
                        <th className="text-left py-2 px-3 font-semibold text-blue-900">Product</th>
                        <th className="text-center py-2 px-3 font-semibold text-blue-700">Yesterday Closing</th>
                        <th className="text-center py-2 px-3 font-semibold text-green-700">→ Today's Opening</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {closing.map((c: any) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3 font-medium">{c.productName}</td>
                          <td className="py-2 px-3 text-center text-blue-700 font-bold">{c.quantity}</td>
                          <td className="py-2 px-3 text-center text-green-700 font-bold">{c.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div className="flex gap-2 flex-wrap">
              {isAdmin ? (
                <Button
                  onClick={() => carryForwardMutation.mutate()}
                  disabled={carryForwardMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Sunrise className="h-4 w-4 mr-1.5" />
                  {carryForwardMutation.isPending ? "Starting…" : "Set as Today's Opening Stock"}
                </Button>
              ) : (
                <Button
                  onClick={() => requestNewDayMutation.mutate()}
                  disabled={requestNewDayMutation.isPending || hasPendingNewDayRequest}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Sunrise className="h-4 w-4 mr-1.5" />
                  {requestNewDayMutation.isPending
                    ? "Sending Request…"
                    : hasPendingNewDayRequest
                    ? "Request Already Sent"
                    : "Request New Day from Admin"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowNewDayDialog(false)}>
                {isAdmin ? "Enter Manually" : "Cancel"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isAdmin
                ? "You can still adjust individual counts manually after carrying forward."
                : "An admin will be notified and must approve before today's opening stock is set."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending expenses warning — personal liability notice */}
      {pendingExpensesByPerson.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            Unapproved Expenses — Personal Liability
          </div>
          <p className="text-xs text-amber-700">
            Per company policy, expenses not yet approved by admin must be covered personally by whoever submitted them. No loans allowed.
          </p>
          <div className="space-y-1">
            {pendingExpensesByPerson.map((p) => (
              <div key={p.submittedBy} className="flex items-center justify-between text-sm bg-white border border-amber-100 rounded-lg px-3 py-2">
                <span className="font-medium text-amber-900">{p.submittedBy}</span>
                <span className="text-xs text-amber-600 mr-auto ml-2">{p.count} pending expense{p.count !== 1 ? "s" : ""}</span>
                <span className="font-bold text-amber-800">{formatUGX(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow steps — tap any badge to jump to that section */}
      <div className="flex items-center gap-2 flex-wrap">
        <StepBadge n={1} label="Production" done={hasProduction} onClick={() => scrollTo("section-production")} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={2} label="Shop Receipt" done={hasReceipts} onClick={() => scrollTo("section-receipt")} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={3} label="Sales" done={hasSales} onClick={() => scrollTo("section-sales")} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={4} label="End of Day" done={isTodayClosed} onClick={() => scrollTo("section-endofday")} />
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
        >
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      {/* ── SHIFT HISTORY ── */}
      {showHistory && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold">Shift History — Last 30 Days</h2>
              <button onClick={() => setShowHistory(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : !shiftHistory || shiftHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No history yet — data will appear after your first day of activity.</p>
            ) : (
              <div className="space-y-2">
                {shiftHistory.map((day: any) => {
                  const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                  const expanded = !!expandedDays[day.date];
                  return (
                    <div key={day.date} className="rounded-lg border border-border bg-background overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
                        onClick={() => toggleHistoryDay(day.date)}
                      >
                        <span className="font-medium w-40 text-left">{dateLabel}</span>
                        {day.closing ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Closed
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Not closed
                          </span>
                        )}
                        <span className="ml-auto text-muted-foreground">POS: <span className="font-semibold text-foreground">{formatUGX(day.posRevenue)}</span></span>
                        <span className="text-muted-foreground ml-3">Counted: <span className="font-semibold text-foreground">{formatUGX(day.countedRevenue)}</span></span>
                        <span className="ml-3 font-bold text-primary">{formatUGX(day.grandTotal)}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground ml-2 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                          {/* Goods received */}
                          {day.items && day.items.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Goods Received from Bakery</p>
                              <div className="flex flex-wrap gap-2">
                                {day.items.map((item: any, i: number) => (
                                  <span key={i} className="text-xs bg-blue-50 text-blue-800 border border-blue-100 rounded px-2 py-1">
                                    {item.productName}: <strong>{item.quantity}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Count details */}
                          {day.counts && day.counts.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Counted Stock Sold</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Product</th>
                                      <th className="text-center py-1.5 px-2 font-medium text-blue-600">Opening</th>
                                      <th className="text-center py-1.5 px-2 font-medium text-purple-600">Closing</th>
                                      <th className="text-center py-1.5 px-2 font-medium text-green-600">Sold</th>
                                      <th className="text-right py-1.5 pl-2 font-medium text-primary">Revenue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.counts.map((c: any, i: number) => (
                                      <tr key={i} className="border-b border-border last:border-0">
                                        <td className="py-1.5 pr-3 font-medium">{c.productName}</td>
                                        <td className="py-1.5 px-2 text-center text-blue-700">{c.opening}</td>
                                        <td className="py-1.5 px-2 text-center text-purple-700">{c.closing}</td>
                                        <td className="py-1.5 px-2 text-center font-bold text-green-700">{c.sold}</td>
                                        <td className="py-1.5 pl-2 text-right text-primary">{formatUGX(c.revenue)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {/* POS summary */}
                          {day.posTransactions > 0 && (
                            <p className="text-xs text-muted-foreground">
                              POS: {day.posTransactions} transaction{day.posTransactions !== 1 ? "s" : ""} · <strong>{formatUGX(day.posRevenue)}</strong>
                            </p>
                          )}
                          {day.closing && (
                            <p className="text-xs text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Closed by <strong>{day.closing.closedBy}</strong> at {new Date(day.closing.closedAt).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 1: PRODUCTION ── */}
      {showProduction && (
        <Card id="section-production">
          <CardContent className="p-5">
            <button className="w-full flex items-center gap-2 mb-3 text-left" onClick={() => toggleSection("production")}>
              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">1</div>
              <Factory className="h-4 w-4 text-orange-600" />
              <h2 className="font-semibold">Produced at Bakery Today</h2>
              <span className="ml-auto text-xs text-muted-foreground">{production.totalUnits} units total</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${collapsed["production"] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed["production"] && (production.byProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing recorded in production yet today</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Qty Produced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {production.byProduct.map((p: any) => (
                      <tr key={p.productId} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium">{p.productName}</td>
                        <td className="py-2 text-right text-orange-700 font-semibold">{p.totalProduced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {!collapsed["production"] && production.entries.length > 0 && (
              <details className="mt-3" open>
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mb-2">Activity log — tap ✎ to correct a mistake</summary>
                <div className="space-y-1 rounded-lg border border-border overflow-hidden">
                  {[...production.entries].reverse().map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 bg-background hover:bg-muted/20">
                      <div className="flex-1 min-w-0 text-xs">
                        <span className="font-medium text-foreground">{e.recordedBy}</span>
                        <span className="text-muted-foreground"> · {e.quantity} × {e.productName}{e.notes ? ` (${e.notes})` : ""}</span>
                        <span className="text-muted-foreground ml-2">{formatTime(e.producedAt)}</span>
                      </div>
                      <button
                        onClick={() => setEditProd({ id: e.id, productName: e.productName ?? "", entryType: e.entryType ?? "new_batch", quantity: String(e.quantity), notes: e.notes ?? "" })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary rounded-md px-2 py-1 transition-colors shrink-0"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: SHOP RECEIPT ── */}
      {showSales && (
        <Card id="section-receipt" className={!hasProduction ? "opacity-70" : ""}>
          <CardContent className="p-5">
            <button className="w-full flex items-center gap-2 mb-3 text-left" onClick={() => toggleSection("receipt")}>
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
              <Truck className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold">Goods Received at Shop</h2>
              <span className="ml-auto text-xs text-muted-foreground">{receipts.totalReceived} units confirmed</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${collapsed["receipt"] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed["receipt"] && <>
              <p className="text-xs text-muted-foreground mb-3">When goods arrive from the bakery, count them and confirm what you received.</p>
              {receipts.byProduct.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Confirmed Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.byProduct.map((r: any) => (
                        <tr key={r.productId} className="border-b border-border last:border-0">
                          <td className="py-2 font-medium">{r.productName}</td>
                          <td className="py-2 text-right text-blue-700 font-semibold">{r.totalReceived}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {receipts.entries.length > 0 && (
                <details className="mb-3" open>
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mb-2">Receipt log — tap ✎ to correct a mistake</summary>
                  <div className="space-y-1 rounded-lg border border-border overflow-hidden">
                    {[...receipts.entries].reverse().map((e: any) => (
                      <div key={e.id} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 bg-background hover:bg-muted/20">
                        <div className="flex-1 min-w-0 text-xs">
                          <span className="font-medium text-foreground">{e.receivedBy}</span>
                          <span className="text-muted-foreground"> · {e.quantityReceived} × {e.productName}{e.notes ? ` (${e.notes})` : ""}</span>
                          <span className="text-muted-foreground ml-2">{formatTime(e.receivedAt)}</span>
                        </div>
                        <button
                          onClick={() => setEditReceipt({ id: e.id, productName: e.productName ?? "", quantityReceived: String(e.quantityReceived), notes: e.notes ?? "" })}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary rounded-md px-2 py-1 transition-colors shrink-0"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {!showReceiptForm ? (
                <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => setShowReceiptForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Confirm New Delivery
                </Button>
              ) : (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">What did you receive?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                      <Select value={receiptForm.productId} onValueChange={(v) => setReceiptForm({ ...receiptForm, productId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent className="max-h-52 overflow-y-auto">
                          {(products ?? []).filter((p: any) => p.isActive).map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantity received</label>
                      <Input type="number" min="1" value={receiptForm.quantityReceived} onChange={(e) => setReceiptForm({ ...receiptForm, quantityReceived: e.target.value })} placeholder="e.g. 50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                    <Input value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} placeholder="e.g. 5 were broken" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!receiptForm.productId || !receiptForm.quantityReceived || addReceiptMutation.isPending}
                      onClick={() => addReceiptMutation.mutate({ productId: Number(receiptForm.productId), quantityReceived: Number(receiptForm.quantityReceived), notes: receiptForm.notes || undefined })}>
                      {addReceiptMutation.isPending ? "Saving..." : "Confirm Receipt"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowReceiptForm(false); setReceiptForm({ productId: "", quantityReceived: "", notes: "" }); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </>}
          </CardContent>
        </Card>
      )}

      {/* ── DRINKS SOLD TODAY (POS) ── */}
      {showSales && (
        <Card>
          <CardContent className="p-5">
            <button className="w-full flex items-center gap-2 mb-3 text-left" onClick={() => toggleSection("drinks")}>
              <Coffee className="h-4 w-4 text-cyan-600" />
              <h2 className="font-semibold">Drinks Sold Today</h2>
              <span className="ml-auto font-bold text-cyan-700 text-sm">{formatUGX(drinkRevenue)}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${collapsed["drinks"] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed["drinks"] && (drinksSoldToday.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No drinks sold through POS yet today</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Drink</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Units Sold</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drinksSoldToday.map((p: any) => (
                      <tr key={p.productId} className="border-t border-border hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-medium">{p.productName}</td>
                        <td className="py-2.5 px-3 text-right">{p.qtySold}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-cyan-700">{formatUGX(p.revenue)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-bold bg-muted/30">
                      <td colSpan={2} className="py-2.5 px-3 text-sm">Total</td>
                      <td className="py-2.5 px-3 text-right text-primary">{formatUGX(drinkRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── COUNTED STOCK — DATE HEADER ── */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Daily Counted Stock</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={prevCountDay} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium min-w-28 justify-center">
            {isToday && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
            {countsDateLabel}
          </div>
          <button
            onClick={nextCountDay}
            disabled={isToday}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isToday && (
            <button onClick={() => setCountsDate(todayStr)} className="text-xs text-primary hover:underline font-medium">
              Back to today
            </button>
          )}
        </div>
      </div>

      {/* ── ICE CREAM COUNT ── */}
      <CountSection
        title="Ice Cream Count"
        icon={<IceCream className="h-4 w-4" />}
        entries={iceCreamEntries}
        color="pink"
        onSave={handleSaveCount}
        isSaving={saveCountMutation.isPending}
      />

      {/* ── JUICE COUNT ── */}
      <CountSection
        title="Juice Count — Small Tins & Big Tins"
        icon={<Droplets className="h-4 w-4" />}
        entries={juiceEntries}
        color="orange"
        onSave={handleSaveCount}
        isSaving={saveCountMutation.isPending}
      />

      {/* ── COFFEE COUNT ── */}
      <CountSection
        title="Coffee Count"
        icon={<Coffee className="h-4 w-4" />}
        entries={coffeeEntries}
        color="amber"
        onSave={handleSaveCount}
        isSaving={saveCountMutation.isPending}
      />

      {/* ── TEA COUNT ── */}
      <CountSection
        title="Tea Count"
        icon={<Coffee className="h-4 w-4" />}
        entries={teaEntries}
        color="green"
        onSave={handleSaveCount}
        isSaving={saveCountMutation.isPending}
      />

      {/* ── DRINKS FRIDGE STOCK ── */}
      <Card>
        <CardContent className="p-5">
          <button className="w-full flex items-center gap-2 mb-3 text-left" onClick={() => toggleSection("fridge-drinks")}>
            <GlassWater className="h-4 w-4 text-cyan-600" />
            <h2 className="font-semibold">Drinks Fridge Stock</h2>
            {lowDrinkCount > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
                {lowDrinkCount} low
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${collapsed["fridge-drinks"] ? "-rotate-90" : ""}`} />
          </button>
          {!collapsed["fridge-drinks"] && (
            <>
              {drinkStock.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No drink products found. Add drinks in the Products page with category "drink" or "milk".
                </p>
              ) : (
                <>
                  {/* Sodas / Energy / Water */}
                  {sodaStock.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <GlassWater className="h-3.5 w-3.5" /> Sodas, Water &amp; Energy Drinks
                      </p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Drink</th>
                              <th className="text-center py-2 px-3 font-medium text-muted-foreground">In Stock</th>
                              <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                              <th className="py-2 px-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sodaStock.map((d) => (
                              <tr key={d.productId} className={`border-t border-border ${d.isLow ? "bg-red-50/60" : ""}`}>
                                <td className="py-2 px-3 font-medium">{d.productName}</td>
                                <td className="py-2 px-3 text-center font-bold text-lg">{d.currentStock}</td>
                                <td className="py-2 px-3 text-center">
                                  {d.isLow ? (
                                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">Low</span>
                                  ) : (
                                    <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">OK</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <button
                                    onClick={() => { setDrinkStockDialog({ productId: d.productId, productName: d.productName }); setDrinkStockQty(""); setDrinkStockNote(""); }}
                                    className="flex items-center gap-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 rounded-lg px-2 py-1 font-medium transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Stock In
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* Milk / Dairy */}
                  {milkStock.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <Milk className="h-3.5 w-3.5" /> Milk &amp; Dairy Products
                      </p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Product</th>
                              <th className="text-center py-2 px-3 font-medium text-muted-foreground">In Stock</th>
                              <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                              <th className="py-2 px-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {milkStock.map((d) => (
                              <tr key={d.productId} className={`border-t border-border ${d.isLow ? "bg-red-50/60" : ""}`}>
                                <td className="py-2 px-3 font-medium">{d.productName}</td>
                                <td className="py-2 px-3 text-center font-bold text-lg">{d.currentStock}</td>
                                <td className="py-2 px-3 text-center">
                                  {d.isLow ? (
                                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">Low</span>
                                  ) : (
                                    <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">OK</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <button
                                    onClick={() => { setDrinkStockDialog({ productId: d.productId, productName: d.productName }); setDrinkStockQty(""); setDrinkStockNote(""); }}
                                    className="flex items-center gap-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 rounded-lg px-2 py-1 font-medium transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Stock In
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              <Dialog open={!!drinkStockDialog} onOpenChange={(open) => { if (!open) { setDrinkStockDialog(null); setDrinkStockQty(""); setDrinkStockNote(""); } }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-green-600" /> Stock In — {drinkStockDialog?.productName}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="bg-green-50 text-green-800 text-sm rounded-lg px-4 py-3">
                      Record stock received for this item — delivery arrived or restocked.
                    </div>
                    <div>
                      <Label>Quantity received</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 24"
                        value={drinkStockQty}
                        onChange={(e) => setDrinkStockQty(e.target.value)}
                        className="mt-1"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input
                        placeholder="e.g. Delivery from supplier"
                        value={drinkStockNote}
                        onChange={(e) => setDrinkStockNote(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setDrinkStockDialog(null); setDrinkStockQty(""); setDrinkStockNote(""); }}>Cancel</Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={!drinkStockQty || parseInt(drinkStockQty) <= 0 || adjustDrinkMutation.isPending}
                        onClick={() => {
                          const qty = parseInt(drinkStockQty);
                          if (!drinkStockDialog || isNaN(qty) || qty <= 0) return;
                          adjustDrinkMutation.mutate({ productId: drinkStockDialog.productId, quantity: qty, reason: drinkStockNote || "Stock received" });
                        }}
                      >
                        {adjustDrinkMutation.isPending ? "Saving…" : "Add to Stock"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── COUNTED SALES SUMMARY (always visible) ── */}
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {isToday ? "Today's" : `${countsDateLabel}'s`} Counted Sales Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-pink-700">
                <IceCream className="h-4 w-4" /> Ice Cream (Cones + Tins)
              </span>
              <div className="text-right">
                {iceCreamRevenue > 0 ? (
                  <span className="font-bold text-pink-700">{formatUGX(iceCreamRevenue)}</span>
                ) : iceCreamEntries.some(e => e.opening !== undefined) ? (
                  <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Enter closing count</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No counts yet</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-orange-700">
                <Droplets className="h-4 w-4" /> Juice (Small + Big Tins)
              </span>
              <div className="text-right">
                {juiceRevenue > 0 ? (
                  <span className="font-bold text-orange-700">{formatUGX(juiceRevenue)}</span>
                ) : juiceEntries.some(e => e.opening !== undefined) ? (
                  <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Enter closing count</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No counts yet</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-amber-700">
                <Coffee className="h-4 w-4" /> Coffee
              </span>
              <div className="text-right">
                {coffeeRevenue > 0 ? (
                  <span className="font-bold text-amber-700">{formatUGX(coffeeRevenue)}</span>
                ) : coffeeEntries.some(e => e.opening !== undefined) ? (
                  <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Enter closing count</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No counts yet</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-green-700">
                <Coffee className="h-4 w-4" /> Tea
              </span>
              <div className="text-right">
                {teaRevenue > 0 ? (
                  <span className="font-bold text-green-700">{formatUGX(teaRevenue)}</span>
                ) : teaEntries.some(e => e.opening !== undefined) ? (
                  <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Enter closing count</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No counts yet</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center px-3 py-2 bg-cyan-50 border border-cyan-100 rounded-lg text-sm">
              <span className="flex items-center gap-2 text-cyan-700">
                <GlassWater className="h-4 w-4" /> Drinks Fridge Stock
              </span>
              <div className="text-right">
                {lowDrinkCount > 0 ? (
                  <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                    {lowDrinkCount} item{lowDrinkCount > 1 ? "s" : ""} low
                  </span>
                ) : drinkStock.length > 0 ? (
                  <span className="text-xs text-green-600 font-medium">All stocked</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No drinks added</span>
                )}
              </div>
            </div>
            {(iceCreamRevenue > 0 || juiceRevenue > 0 || coffeeRevenue > 0 || teaRevenue > 0) && (
              <div className="flex justify-between items-center px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg font-bold mt-1">
                <span className="text-sm">Total Counted Sales</span>
                <span className="text-primary">{formatUGX(iceCreamRevenue + juiceRevenue + coffeeRevenue + teaRevenue)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">
            Sold = Opening count minus Closing count. Enter both opening and closing for each item to see the sales total.
          </p>
        </CardContent>
      </Card>

      {/* ── STEP 3: BAKED GOODS SALES TODAY ── */}
      {showSales && (
        <Card id="section-sales">
          <CardContent className="p-5">
            <button className="w-full flex items-center gap-2 mb-3 text-left" onClick={() => toggleSection("sales")}>
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</div>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
              <h2 className="font-semibold">Baked Goods Sales Today</h2>
              <span className="ml-auto text-sm font-bold text-primary">{formatUGX(sales.totalRevenue)}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${collapsed["sales"] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed["sales"] && (sales.byProduct.filter((p: any) => !(products ?? []).find((pr: any) => pr.id === p.productId && ["drink", "milk"].includes(pr.category))).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No baked goods sold yet today</p>
            ) : (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Units</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.byProduct
                      .filter((p: any) => !(products ?? []).find((pr: any) => pr.id === p.productId && ["drink", "milk"].includes(pr.category)))
                      .map((p: any) => (
                        <tr key={p.productId} className="border-b border-border last:border-0">
                          <td className="py-2 font-medium">{p.productName}</td>
                          <td className="py-2 text-right">{p.qtySold}</td>
                          <td className="py-2 text-right font-semibold text-purple-700">{formatUGX(p.revenue)}</td>
                        </tr>
                      ))}
                    <tr className="font-bold">
                      <td colSpan={2} className="py-2 text-sm">Total</td>
                      <td className="py-2 text-right text-primary">{formatUGX(sales.totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
            {!collapsed["sales"] && sales.transactions.length > 0 && (
              <details>
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View sales log ({sales.transactionCount} transactions)</summary>
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {[...sales.transactions].reverse().map((t: any) => (
                    <div key={t.id} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">{t.soldBy}</span>
                        {" · "}{formatUGX(t.totalAmount)}
                        {" · "}{t.itemCount} item{t.itemCount !== 1 ? "s" : ""}
                        {" · "}{t.paymentMethod === "cash" ? "Cash" : t.paymentMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"}
                      </span>
                      <span className="text-muted-foreground ml-3 shrink-0">{formatTime(t.soldAt)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CASHIER DAILY PAY (admin only) ── */}
      {isAdmin && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <button
              className="w-full flex items-center gap-2 mb-4 text-left"
              onClick={() => toggleSection("daily-pay")}
            >
              <Banknote className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold">Cashier Daily Pay</h2>
              <span className="text-xs text-muted-foreground ml-1 font-normal">Submit today's salaries for approval</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-auto transition-transform ${collapsed["daily-pay"] ? "-rotate-90" : ""}`} />
            </button>

            {!collapsed["daily-pay"] && (
              dailyPayData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No cashiers checked in today.</p>
              ) : (
                <div className="space-y-3">
                  {dailyPayData.map((c: any) => (
                    <div key={c.employeeId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 shadow-sm gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.hoursWorked ? `${Number(c.hoursWorked).toFixed(1)} hrs · ` : ""}
                            {c.salary
                              ? `UGX ${c.dailyRate.toLocaleString()} / day`
                              : <span className="text-amber-600">No salary on file</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.alreadySubmitted ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            c.expenseStatus === "approved"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : c.expenseStatus === "rejected"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {c.expenseStatus === "approved" ? "✓ Paid" : c.expenseStatus === "rejected" ? "Rejected" : "Pending"}
                          </span>
                        ) : (
                          <>
                            {!c.salary && (
                              <Input
                                type="number"
                                placeholder="Amount (UGX)"
                                className="w-36 h-8 text-sm"
                                value={customAmounts[c.employeeId] ?? ""}
                                onChange={(e) =>
                                  setCustomAmounts((prev) => ({ ...prev, [c.employeeId]: e.target.value }))
                                }
                              />
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                              disabled={
                                submitPayMutation.isPending ||
                                (!c.salary && !customAmounts[c.employeeId])
                              }
                              onClick={() => {
                                const amount = c.salary
                                  ? c.dailyRate
                                  : parseInt(customAmounts[c.employeeId] ?? "0", 10);
                                if (!amount || amount <= 0) return;
                                submitPayMutation.mutate({ name: c.name, amount });
                              }}
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1" /> Submit Pay
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    Submitted salaries go into the expenses approval queue. Martha or Shadrach must approve before payment is released.
                  </p>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 4: END OF DAY — CASHIER ACCOUNTABILITY ── */}
      <Card id="section-endofday" className="border-primary/30">
        <CardContent className="p-5">
          <button className="w-full flex items-center gap-2 mb-4 text-left" onClick={() => toggleSection("endofday")}>
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">End of Day — Cashier Accountability</h2>
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-auto transition-transform ${collapsed["endofday"] ? "-rotate-90" : ""}`} />
          </button>

          {!collapsed["endofday"] && <>
          {accountability.cashiers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No cashier activity recorded yet today</p>
          ) : (
            <div className="space-y-3 mb-5">
              {accountability.cashiers.map((c: any) => (
                <div key={c.name} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.transactions} sale{c.transactions !== 1 ? "s" : ""}
                        {c.unitsReceivedFromBakery > 0 && ` · ${c.unitsReceivedFromBakery} units received`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary text-sm">{formatUGX(c.totalSales)}</div>
                    <div className="text-xs text-muted-foreground">must submit</div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 mt-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">Combined Total ({accountability.cashiers.length} cashier{accountability.cashiers.length !== 1 ? "s" : ""})</span>
                </div>
                <span className="font-bold text-primary text-lg">{formatUGX(accountability.combinedRevenue)}</span>
              </div>
            </div>
          )}

          {/* Grand Total (POS + Counted) */}
          {(sales.totalRevenue > 0 || iceCreamRevenue > 0 || juiceRevenue > 0 || coffeeRevenue > 0 || teaRevenue > 0) && (
            <div className="mb-4 space-y-1.5">
              {sales.totalRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
                  <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-purple-500" /> POS Sales (Baked Goods + Drinks)</span>
                  <span className="font-bold text-purple-700">{formatUGX(sales.totalRevenue)}</span>
                </div>
              )}
              {iceCreamRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg">
                  <span className="flex items-center gap-2"><IceCream className="h-4 w-4 text-pink-500" /> Ice Cream (counted)</span>
                  <span className="font-bold text-pink-700">{formatUGX(iceCreamRevenue)}</span>
                </div>
              )}
              {juiceRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg">
                  <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-orange-500" /> Juice (counted)</span>
                  <span className="font-bold text-orange-700">{formatUGX(juiceRevenue)}</span>
                </div>
              )}
              {coffeeRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="flex items-center gap-2"><Coffee className="h-4 w-4 text-amber-500" /> Coffee (counted)</span>
                  <span className="font-bold text-amber-700">{formatUGX(coffeeRevenue)}</span>
                </div>
              )}
              {teaRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                  <span className="flex items-center gap-2"><Coffee className="h-4 w-4 text-green-500" /> Tea (counted)</span>
                  <span className="font-bold text-green-700">{formatUGX(teaRevenue)}</span>
                </div>
              )}
              {approvedExpensesTotal > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <span className="flex items-center gap-2 text-red-700">
                    <Wallet className="h-4 w-4" /> Approved Expenses (deducted)
                  </span>
                  <span className="font-bold text-red-600">−{formatUGX(approvedExpensesTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-3 py-3 bg-primary/5 border border-primary/20 rounded-lg font-bold">
                <span className="text-sm">Grand Total {approvedExpensesTotal > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">(after expenses)</span>}</span>
                <span className="text-primary text-xl">{formatUGX(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* Stock accountability table */}
          {accountabilityRows.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" /> Stock Accountability
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Product</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Received</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Sold</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Remaining</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountabilityRows.map((row, i) => {
                      const expected = row.received - row.sold;
                      const diff = row.remaining - expected;
                      return (
                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{row.name}</td>
                          <td className="py-2.5 px-3 text-right text-blue-700">{row.received}</td>
                          <td className="py-2.5 px-3 text-right text-purple-700">{row.sold}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`font-semibold ${diff < 0 ? "text-red-600" : "text-green-700"}`}>{row.remaining}</span>
                            {diff !== 0 && <span className={`text-xs ml-1 ${diff < 0 ? "text-red-500" : "text-green-500"}`}>({diff > 0 ? "+" : ""}{diff})</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden md:table-cell">{formatUGX(row.remaining * row.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </>}
        </CardContent>
      </Card>

      {/* ── CLOSE DAY ── */}
      <Card className={`border-2 ${isTodayClosed ? "border-green-200 bg-green-50/40" : isPendingClose ? "border-amber-200 bg-amber-50/30" : "border-dashed border-primary/30"}`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <MoonStar className={`h-5 w-5 ${isTodayClosed ? "text-green-600" : isPendingClose ? "text-amber-500" : "text-primary"}`} />
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {isTodayClosed ? "Today's Shift is Closed" : isPendingClose ? "Close Day — Pending Admin Approval" : "Close Today's Shift"}
              </h3>
              {isTodayClosed ? (
                <p className="text-xs text-green-700 mt-0.5">
                  Closed by <strong>{todayClosing.closedBy}</strong> at {new Date(todayClosing.closedAt).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
                  {todayClosing.approvedBy && ` · Approved by ${todayClosing.approvedBy}`} — grand total <strong>{formatUGX(grandTotal)}</strong>
                </p>
              ) : isPendingClose ? (
                <p className="text-xs text-amber-700 mt-0.5">
                  Requested by <strong>{todayClosing.closedBy}</strong>.{" "}
                  {isAdmin ? "Review and approve or reject below." : "Waiting for an admin to review."}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAdmin
                    ? "Mark this day as done. All counts and sales are saved and will appear in the history and monthly report."
                    : "Submit a close day request. An admin will review and approve it before the day is officially closed."}
                </p>
              )}
            </div>
            {!isTodayClosed && !isPendingClose ? (
              <Button
                onClick={() => setShowCloseConfirm(true)}
                className="shrink-0 bg-primary text-primary-foreground"
                disabled={closeDayMutation.isPending}
              >
                <MoonStar className="h-4 w-4 mr-1.5" /> {isAdmin ? "Close Day" : "Request Close"}
              </Button>
            ) : null}
          </div>

          {/* Admin: approve / reject the pending close request */}
          {isPendingClose && isAdmin && (
            <div className="mt-4 p-4 bg-background border border-amber-200 rounded-xl space-y-3">
              <p className="text-sm font-medium">
                <strong>{todayClosing.closedBy}</strong> has requested to close today's shift.
              </p>
              <p className="text-xs text-muted-foreground">
                Grand total today: <strong>{formatUGX(grandTotal)}</strong>. Review the counts and sales above, then decide.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveCloseMutation.mutate({ id: todayClosing.id, action: "approve" })}
                  disabled={approveCloseMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Close Day
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approveCloseMutation.mutate({ id: todayClosing.id, action: "reject" })}
                  disabled={approveCloseMutation.isPending}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Reject Request
                </Button>
              </div>
            </div>
          )}

          {/* Confirmation dialog inline */}
          {showCloseConfirm && !isTodayClosed && !isPendingClose && (
            <div className="mt-4 p-4 bg-background border border-border rounded-xl space-y-3">
              <p className="text-sm font-medium">
                {isAdmin ? "Confirm closing today's shift?" : "Submit a close day request to admin?"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? `This records a formal end to the shift for ${today}. You can still add or edit data after closing — this is just a marker.`
                  : "Your request will be sent to admin for review. The day will only be officially closed once an admin approves it."}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => closeDayMutation.mutate()}
                  disabled={closeDayMutation.isPending}
                >
                  {closeDayMutation.isPending ? "Submitting..." : isAdmin ? "Yes, Close Day" : "Send Request"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCloseConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── EDIT PRODUCTION ENTRY DIALOG ── */}
      <Dialog open={!!editProd} onOpenChange={(o) => { if (!o) setEditProd(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Production Entry</DialogTitle>
            {editProd && <p className="text-sm text-muted-foreground mt-1">Editing: <span className="font-medium text-foreground">{editProd.productName}</span></p>}
          </DialogHeader>
          {editProd && (
            <form onSubmit={(e) => { e.preventDefault(); editProdMutation.mutate(editProd); }} className="space-y-4">
              <div>
                <Label>Entry Type</Label>
                <Select value={editProd.entryType} onValueChange={(v) => setEditProd({ ...editProd, entryType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leftover">Yesterday's Leftover</SelectItem>
                    <SelectItem value="new_batch">New Batch (Chef)</SelectItem>
                    <SelectItem value="closing">Evening Closing Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="0" value={editProd.quantity} onChange={(e) => setEditProd({ ...editProd, quantity: e.target.value })} className="mt-1" required />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={editProd.notes} onChange={(e) => setEditProd({ ...editProd, notes: e.target.value })} className="mt-1" rows={2} placeholder="Reason for correction..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditProd(null)}>Cancel</Button>
                <Button type="submit" disabled={editProdMutation.isPending}>{editProdMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT RECEIPT ENTRY DIALOG ── */}
      <Dialog open={!!editReceipt} onOpenChange={(o) => { if (!o) setEditReceipt(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Goods Received Entry</DialogTitle>
            {editReceipt && <p className="text-sm text-muted-foreground mt-1">Editing: <span className="font-medium text-foreground">{editReceipt.productName}</span></p>}
          </DialogHeader>
          {editReceipt && (
            <form onSubmit={(e) => { e.preventDefault(); editReceiptMutation.mutate(editReceipt); }} className="space-y-4">
              <div>
                <Label>Quantity Received</Label>
                <Input type="number" min="0" value={editReceipt.quantityReceived} onChange={(e) => setEditReceipt({ ...editReceipt, quantityReceived: e.target.value })} className="mt-1" required />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={editReceipt.notes} onChange={(e) => setEditReceipt({ ...editReceipt, notes: e.target.value })} className="mt-1" rows={2} placeholder="Reason for correction..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditReceipt(null)}>Cancel</Button>
                <Button type="submit" disabled={editReceiptMutation.isPending}>{editReceiptMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
