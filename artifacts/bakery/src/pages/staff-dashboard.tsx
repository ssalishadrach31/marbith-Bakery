import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser, formatUGX, formatTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Factory, ShoppingCart, Package, Wallet,
  Clock, RefreshCw, CheckCircle2,
  Truck, ChevronRight, Plus, Users,
  IceCream, Coffee, Droplets, ChevronLeft,
  CalendarDays, ArrowRight,
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

function StepBadge({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border ${done ? "bg-green-100 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="w-4 h-4 flex items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-bold">{n}</span>}
      {label}
    </div>
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

  // Only count sold when BOTH opening and closing are set
  const totalSold = entries.reduce((s, e) => {
    if (e.opening === undefined || e.closing === undefined) return s;
    const sold = Math.max(0, e.opening - e.closing);
    return s + sold;
  }, 0);
  const totalRevenue = entries.reduce((s, e) => {
    if (e.opening === undefined || e.closing === undefined) return s;
    const sold = Math.max(0, e.opening - e.closing);
    return s + sold * e.price;
  }, 0);

  const allComplete = entries.length > 0 && entries.every((e) => e.opening !== undefined && e.closing !== undefined);
  const hasOpening = entries.some((e) => e.opening !== undefined);
  const hasClosing = entries.some((e) => e.closing !== undefined);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
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
                <Clock className="h-3 w-3" /> Opening set — enter closing to see sales
              </span>
            ) : !hasOpening ? (
              <span className="text-xs text-muted-foreground">Enter opening count to begin</span>
            ) : (
              <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">Partial counts</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {entries.length > 0 && (
          <div className="flex gap-1 mb-4">
            {entries.map((e) => {
              const bothDone = e.opening !== undefined && e.closing !== undefined;
              const onlyOpen = e.opening !== undefined && e.closing === undefined;
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

        <div className="overflow-x-auto rounded-lg border border-border">
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
              {entries.map((entry) => {
                const sold = entry.opening !== undefined && entry.closing !== undefined
                  ? Math.max(0, entry.opening - entry.closing)
                  : null;
                const revenue = sold !== null ? sold * entry.price : null;
                const openKey = `${entry.productId}-opening`;
                const closeKey = `${entry.productId}-closing`;

                return (
                  <tr key={entry.productId} className="border-t border-border hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-medium">{entry.productName}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{formatUGX(entry.price)}</td>

                    {/* Opening count */}
                    <td className="py-2 px-2 text-center">
                      {entry.opening !== undefined ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-blue-700 text-base">{entry.opening}</span>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground ml-1"
                            onClick={() => setDrafts((d) => ({ ...d, [openKey]: String(entry.opening) }))}
                          >✎</button>
                        </div>
                      ) : drafts[openKey] !== undefined ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            min="0"
                            className="h-7 w-16 text-center text-sm p-1"
                            value={drafts[openKey]}
                            onChange={(e) => setDrafts((d) => ({ ...d, [openKey]: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className="text-green-600 font-bold text-lg leading-none"
                            disabled={isSaving}
                            onClick={() => {
                              const q = parseInt(drafts[openKey] ?? "");
                              if (!isNaN(q) && q >= 0) {
                                onSave(entry.productId, "opening", q);
                                setDrafts((d) => { const nd = { ...d }; delete nd[openKey]; return nd; });
                              }
                            }}
                          >✓</button>
                        </div>
                      ) : (
                        <button
                          className="text-xs border border-dashed border-blue-300 text-blue-500 rounded px-2 py-1 hover:bg-blue-50"
                          onClick={() => setDrafts((d) => ({ ...d, [openKey]: "" }))}
                        >Enter</button>
                      )}
                    </td>

                    {/* Closing count */}
                    <td className="py-2 px-2 text-center">
                      {entry.closing !== undefined ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-purple-700 text-base">{entry.closing}</span>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground ml-1"
                            onClick={() => setDrafts((d) => ({ ...d, [closeKey]: String(entry.closing) }))}
                          >✎</button>
                        </div>
                      ) : drafts[closeKey] !== undefined ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            min="0"
                            className="h-7 w-16 text-center text-sm p-1"
                            value={drafts[closeKey]}
                            onChange={(e) => setDrafts((d) => ({ ...d, [closeKey]: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className="text-green-600 font-bold text-lg leading-none"
                            disabled={isSaving}
                            onClick={() => {
                              const q = parseInt(drafts[closeKey] ?? "");
                              if (!isNaN(q) && q >= 0) {
                                onSave(entry.productId, "closing", q);
                                setDrafts((d) => { const nd = { ...d }; delete nd[closeKey]; return nd; });
                              }
                            }}
                          >✓</button>
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
                        <span className={`font-bold text-base ${sold === 0 ? "text-muted-foreground" : "text-green-700"}`}>{sold}</span>
                      ) : entry.opening !== undefined && entry.closing === undefined ? (
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
                        <span className={revenue === 0 ? "text-muted-foreground" : "text-green-700 font-bold"}>{formatUGX(revenue)}</span>
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
    refetchInterval: 60_000,
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["products-active"],
    queryFn: () => apiFetch("/products"),
  });

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

  const { data: dailyCounts } = useQuery<any[]>({
    queryKey: ["daily-counts", countsDate],
    queryFn: () => apiFetch(`/daily-counts?date=${countsDate}`),
    refetchInterval: 60_000,
  });

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
      qc.invalidateQueries({ queryKey: ["daily-counts", countsDate] });
      toast({ title: "Count saved", description: `${result.countType === "opening" ? "Opening" : "Closing"}: ${result.quantity} × ${result.productName}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSaveCount(productId: number, countType: "opening" | "closing", quantity: number) {
    saveCountMutation.mutate({ productId, countType, quantity, countDate: countsDate });
  }

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

  if (!data) return null;

  const { production, receipts, sales, inventory, accountability } = data;
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

  // Drinks sold today via POS
  const drinksSoldToday = sales.byProduct.filter((p: any) =>
    (products ?? []).find((pr: any) => pr.id === p.productId && pr.category === "drink")
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
  const grandTotal = sales.totalRevenue + iceCreamRevenue + juiceRevenue + coffeeRevenue;

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

      {/* Workflow steps */}
      <div className="flex items-center gap-2 flex-wrap">
        <StepBadge n={1} label="Production" done={hasProduction} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={2} label="Shop Receipt" done={hasReceipts} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={3} label="Sales" done={hasSales} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <StepBadge n={4} label="End of Day" done={false} />
      </div>

      {/* ── STEP 1: PRODUCTION ── */}
      {showProduction && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">1</div>
              <Factory className="h-4 w-4 text-orange-600" />
              <h2 className="font-semibold">Produced at Bakery Today</h2>
              <span className="ml-auto text-xs text-muted-foreground">{production.totalUnits} units total</span>
            </div>
            {production.byProduct.length === 0 ? (
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
            )}
            {production.entries.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View activity log</summary>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {production.entries.map((e: any) => (
                    <div key={e.id} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground"><span className="text-foreground font-medium">{e.recordedBy}</span> recorded {e.quantity} × {e.productName}{e.notes ? ` (${e.notes})` : ""}</span>
                      <span className="text-muted-foreground ml-3 shrink-0">{formatTime(e.producedAt)}</span>
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
        <Card className={!hasProduction ? "opacity-70" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
              <Truck className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold">Goods Received at Shop</h2>
              <span className="ml-auto text-xs text-muted-foreground">{receipts.totalReceived} units confirmed</span>
            </div>
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
              <details className="mb-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View receipt log</summary>
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {receipts.entries.map((e: any) => (
                    <div key={e.id} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground"><span className="text-foreground font-medium">{e.receivedBy}</span> confirmed {e.quantityReceived} × {e.productName}{e.notes ? ` (${e.notes})` : ""}</span>
                      <span className="text-muted-foreground ml-3 shrink-0">{formatTime(e.receivedAt)}</span>
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
                      <SelectContent>
                        {(products ?? []).filter((p: any) => p.isActive && p.category === "baked_goods").map((p: any) => (
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
          </CardContent>
        </Card>
      )}

      {/* ── DRINKS SOLD TODAY (POS) ── */}
      {showSales && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Coffee className="h-4 w-4 text-cyan-600" />
              <h2 className="font-semibold">Drinks Sold Today</h2>
              <span className="ml-auto font-bold text-cyan-700 text-sm">{formatUGX(drinkRevenue)}</span>
            </div>
            {drinksSoldToday.length === 0 ? (
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
            )}
          </CardContent>
        </Card>
      )}

      {/* ── COUNTED STOCK — DATE HEADER ── */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Ice Cream, Juice & Coffee Counts</span>
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

      {/* ── COFFEE / TEA COUNT ── */}
      <CountSection
        title="Coffee & Tea Count"
        icon={<Coffee className="h-4 w-4" />}
        entries={coffeeEntries}
        color="amber"
        onSave={handleSaveCount}
        isSaving={saveCountMutation.isPending}
      />

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
                <Coffee className="h-4 w-4" /> Coffee & Tea
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
            {(iceCreamRevenue > 0 || juiceRevenue > 0 || coffeeRevenue > 0) && (
              <div className="flex justify-between items-center px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg font-bold mt-1">
                <span className="text-sm">Total Counted Sales</span>
                <span className="text-primary">{formatUGX(iceCreamRevenue + juiceRevenue + coffeeRevenue)}</span>
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
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</div>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
              <h2 className="font-semibold">Baked Goods Sales Today</h2>
              <span className="ml-auto text-sm font-bold text-primary">{formatUGX(sales.totalRevenue)}</span>
            </div>
            {sales.byProduct.filter((p: any) => !(products ?? []).find((pr: any) => pr.id === p.productId && pr.category === "drink")).length === 0 ? (
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
                      .filter((p: any) => !(products ?? []).find((pr: any) => pr.id === p.productId && pr.category === "drink"))
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
            )}
            {sales.transactions.length > 0 && (
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

      {/* ── STEP 4: END OF DAY — CASHIER ACCOUNTABILITY ── */}
      <Card className="border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">End of Day — Cashier Accountability</h2>
          </div>

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
          {(sales.totalRevenue > 0 || iceCreamRevenue > 0 || juiceRevenue > 0 || coffeeRevenue > 0) && (
            <div className="mb-4 space-y-1.5">
              {sales.totalRevenue > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
                  <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-purple-500" /> POS Sales (Baked Goods + Drinks)</span>
                  <span className="font-bold text-purple-700">{formatUGX(sales.totalRevenue)}</span>
                </div>
              )}
              {(iceCreamRevenue + juiceRevenue + coffeeRevenue) > 0 && (
                <div className="flex justify-between text-sm px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                  <span className="flex items-center gap-2"><IceCream className="h-4 w-4 text-green-500" /> Ice Cream + Juice + Coffee (counted)</span>
                  <span className="font-bold text-green-700">{formatUGX(iceCreamRevenue + juiceRevenue + coffeeRevenue)}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-3 py-3 bg-primary/5 border border-primary/20 rounded-lg font-bold">
                <span className="text-sm">Grand Total</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
