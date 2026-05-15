import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getToken, getUser, formatTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Factory,
  Package,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronRight,
  Pencil,
  History,
  Sunrise,
  MoonStar,
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
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.status === 204 ? null : res.json();
}

type EntryType = "leftover" | "new_batch" | "closing";

const ENTRY_TYPE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  leftover: { label: "Yesterday's Leftover", badgeClass: "bg-amber-100 text-amber-700 border-amber-300" },
  new_batch: { label: "New Batch", badgeClass: "bg-green-100 text-green-700 border-green-300" },
  closing: { label: "Closing Stock", badgeClass: "bg-blue-100 text-blue-700 border-blue-300" },
};

type EditState = { id: number; productName: string; entryType: EntryType; quantity: string; notes: string };

export default function BakerDashboardPage() {
  const user = getUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const today = new Date().toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { data: lowStock, isLoading: loadingStock, refetch: refetchStock, isFetching } = useQuery<any[]>({
    queryKey: ["low-stock"],
    queryFn: () => apiFetch("/inventory/low-stock"),
    refetchInterval: 120_000,
  });

  const { data: allInventory } = useQuery<any[]>({
    queryKey: ["inventory"],
    queryFn: () => apiFetch("/inventory"),
    refetchInterval: 120_000,
  });

  const { data: todaySummary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ["production-today"],
    queryFn: () => apiFetch("/production/today-summary"),
    refetchInterval: 60_000,
  });

  const [editRecord, setEditRecord] = useState<EditState | null>(null);

  // ── Self check-in / check-out ─────────────────────────────────────────────
  const { data: selfAttendance, refetch: refetchSelfAttendance } = useQuery<any>({
    queryKey: ["attendance-self-today"],
    queryFn: () => apiFetch("/attendance/self-today"),
    refetchInterval: 60_000,
  });

  const selfCheckInMutation = useMutation({
    mutationFn: () => apiFetch("/attendance/self-check-in", { method: "POST" }),
    onSuccess: () => { refetchSelfAttendance(); toast({ title: "Checked in!", description: "Your arrival time has been recorded." }); },
    onError: (err: any) => toast({ title: "Check-in failed", description: err.message, variant: "destructive" }),
  });

  const selfCheckOutMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/attendance/self-check-out/${id}`, { method: "PUT" }),
    onSuccess: () => { refetchSelfAttendance(); toast({ title: "Checked out!", description: "Your shift has been recorded." }); },
    onError: (err: any) => toast({ title: "Check-out failed", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: EditState) =>
      apiFetch(`/production/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: parseInt(body.quantity), entryType: body.entryType, notes: body.notes || null }),
      }),
    onSuccess: () => {
      refetchSummary();
      toast({ title: "Entry updated", description: "Production record corrected." });
      setEditRecord(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const productionEntries: any[] = todaySummary?.entries ?? [];
  const productionByProduct: any[] = todaySummary?.byProduct ?? [];

  const urgentItems = (lowStock ?? []).filter((i: any) => i.currentStock === 0);
  const lowItems = (lowStock ?? []).filter((i: any) => i.currentStock > 0);

  const totalInStock = (allInventory ?? []).reduce((s: number, i: any) => s + (i.currentStock ?? 0), 0);
  const totalLow = (lowStock ?? []).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kitchen Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {today}
          </p>
        </div>
        <button
          onClick={() => { refetchStock(); refetchSummary(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* User banner */}
      <div className="bg-gradient-to-r from-orange-500/10 to-orange-400/5 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-sm">{user?.name}{user?.jobTitle && <span className="text-xs font-normal text-muted-foreground ml-1">· {user.jobTitle}</span>}</div>
          <div className="text-xs text-muted-foreground">Baker / Chef — Kitchen view</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Units produced today</div>
          <div className="font-bold text-orange-700 text-lg">{todaySummary?.totalUnits ?? 0}</div>
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

      {/* ── STOCK ALERTS ── */}
      <Card className={urgentItems.length > 0 ? "border-red-200" : totalLow > 0 ? "border-amber-200" : "border-green-200"}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-4 w-4 ${urgentItems.length > 0 ? "text-red-500" : totalLow > 0 ? "text-amber-500" : "text-green-500"}`} />
            <h2 className="font-semibold">Stock Alerts — What Needs Baking</h2>
            <span className="ml-auto text-xs text-muted-foreground">{totalInStock} units in stock total</span>
          </div>

          {loadingStock ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (lowStock ?? []).length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-green-700 bg-green-50 border border-green-100 rounded-lg px-4">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">All stock levels are good!</p>
                <p className="text-xs text-green-600 mt-0.5">No items are running low right now.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentItems.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">Out of Stock — Bake Immediately</p>
                  {urgentItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="font-semibold text-sm text-red-900">{item.productName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">0 left</span>
                        <span className="text-xs text-muted-foreground ml-2">min {item.lowStockThreshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {lowItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Running Low — Bake Soon</p>
                  {lowItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-medium text-sm text-amber-900">{item.productName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-amber-100 rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (item.currentStock / item.lowStockThreshold) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-amber-700">{item.currentStock}</span>
                        <span className="text-xs text-muted-foreground">/ min {item.lowStockThreshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full mt-2"
                onClick={() => navigate("/production")}
              >
                <Factory className="h-4 w-4 mr-2" />
                Record Production Batch
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TODAY'S PRODUCTION SUMMARY ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Factory className="h-4 w-4 text-orange-600" />
            <h2 className="font-semibold">Produced Today</h2>
            <span className="ml-auto text-xs text-muted-foreground">{todaySummary?.totalUnits ?? 0} units total</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/production")} className="ml-2 h-7 px-3 text-xs">
              + Add batch
            </Button>
          </div>

          {productionByProduct.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Factory className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nothing recorded yet today.</p>
              <button
                onClick={() => navigate("/production")}
                className="text-primary text-xs mt-1 hover:underline"
              >
                Go to Production →
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Units Baked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionByProduct.map((p: any) => (
                      <tr key={p.productId} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium">{p.productName}</td>
                        <td className="py-2 text-right text-orange-700 font-semibold">{p.totalProduced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Editable entry log */}
              {productionEntries.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Entries — tap ✎ to correct a mistake</p>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {[...productionEntries].reverse().map((e: any) => {
                      const meta = ENTRY_TYPE_LABELS[e.entryType] ?? { label: e.entryType, badgeClass: "" };
                      const isOwn = e.recordedBy === user?.name;
                      return (
                        <div key={e.id} className="flex items-center gap-2 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-xs shrink-0 ${meta.badgeClass}`}>
                                {meta.label}
                              </Badge>
                              <span className="font-medium text-sm">{e.productName}</span>
                              <span className="text-sm font-bold text-orange-700">{e.quantity} units</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                              <span className={isOwn ? "font-medium text-primary" : "font-medium"}>{isOwn ? "You" : e.recordedBy}</span>
                              <span>·</span>
                              <span>{formatTime(e.producedAt)}</span>
                              {e.notes && <span>· <em>{e.notes}</em></span>}
                            </div>
                          </div>
                          <button
                            onClick={() => setEditRecord({ id: e.id, productName: e.productName ?? "", entryType: e.entryType as EntryType, quantity: String(e.quantity), notes: e.notes ?? "" })}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary rounded-md px-2 py-1 transition-colors shrink-0"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── FULL INVENTORY OVERVIEW ── */}
      {(allInventory ?? []).length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold">Full Stock Overview</h2>
              <span className="ml-auto text-xs text-muted-foreground">{(allInventory ?? []).length} products</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">In Stock</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Min Level</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(allInventory ?? []).map((item: any) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-medium">{item.productName}</td>
                      <td className={`py-2.5 px-3 text-right font-semibold ${item.isLow ? (item.currentStock === 0 ? "text-red-600" : "text-amber-600") : "text-green-700"}`}>
                        {item.currentStock}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{item.lowStockThreshold}</td>
                      <td className="py-2.5 px-3 text-right hidden md:table-cell">
                        {item.currentStock === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Out
                          </span>
                        ) : item.isLow ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
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

      {/* ── EDIT PRODUCTION ENTRY DIALOG ── */}
      <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Production Entry</DialogTitle>
            {editRecord && (
              <p className="text-sm text-muted-foreground mt-1">
                Editing: <span className="font-medium text-foreground">{editRecord.productName}</span>
              </p>
            )}
          </DialogHeader>
          {editRecord && (
            <form
              onSubmit={(e) => { e.preventDefault(); editMutation.mutate(editRecord); }}
              className="space-y-4"
            >
              <div>
                <Label>Entry Type</Label>
                <Select value={editRecord.entryType} onValueChange={(v) => setEditRecord({ ...editRecord, entryType: v as EntryType })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leftover">Yesterday's Leftover</SelectItem>
                    <SelectItem value="new_batch">New Batch (Chef)</SelectItem>
                    <SelectItem value="closing">Evening Closing Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{editRecord.entryType === "closing" ? "Count remaining" : "Quantity"}</Label>
                <Input
                  type="number"
                  min="0"
                  value={editRecord.quantity}
                  onChange={(e) => setEditRecord({ ...editRecord, quantity: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={editRecord.notes}
                  onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })}
                  className="mt-1"
                  rows={2}
                  placeholder="Reason for correction..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
