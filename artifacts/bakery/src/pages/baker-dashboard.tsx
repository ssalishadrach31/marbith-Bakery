import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getToken, getUser, formatUGX, formatTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Factory,
  Package,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronRight,
  IceCream,
  Droplets,
  Coffee,
  ArrowRight,
  ChevronLeft,
  CalendarDays,
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

function CountRow({
  entry,
  onSave,
  isSaving,
}: {
  entry: CountEntry;
  onSave: (productId: number, countType: "opening" | "closing", quantity: number) => void;
  isSaving: boolean;
}) {
  const [openingVal, setOpeningVal] = useState("");
  const [closingVal, setClosingVal] = useState("");
  const sold =
    entry.opening !== undefined && entry.closing !== undefined
      ? Math.max(0, entry.opening - entry.closing)
      : null;

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{entry.productName}</span>
        {sold !== null && (
          <span className="text-xs font-bold text-primary">{formatUGX(sold * entry.price)}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Opening{entry.opening !== undefined ? ` · ${entry.opening} (by ${entry.openingBy ?? "?"})` : ""}
          </p>
          {entry.opening === undefined ? (
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={openingVal}
                onChange={(e) => setOpeningVal(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                disabled={!openingVal || isSaving}
                onClick={() => { onSave(entry.productId, "opening", parseInt(openingVal)); setOpeningVal(""); }}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="h-8 flex items-center text-sm font-semibold text-blue-700">{entry.opening}</div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Closing{entry.closing !== undefined ? ` · ${entry.closing} (by ${entry.closingBy ?? "?"})` : ""}
          </p>
          {entry.closing === undefined ? (
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={closingVal}
                onChange={(e) => setClosingVal(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                disabled={!closingVal || isSaving || entry.opening === undefined}
                onClick={() => { onSave(entry.productId, "closing", parseInt(closingVal)); setClosingVal(""); }}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="h-8 flex items-center text-sm font-semibold text-orange-700">{entry.closing}</div>
          )}
        </div>
      </div>
      {sold !== null && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
          Sold today: <span className="font-semibold text-foreground">{sold}</span> units
        </div>
      )}
    </div>
  );
}

export default function BakerDashboardPage() {
  const user = getUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date().toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const [countsDate, setCountsDate] = useState(todayStr);

  function prevDay() {
    const d = new Date(countsDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setCountsDate(d.toISOString().split("T")[0]);
  }
  function nextDay() {
    const d = new Date(countsDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    if (d.toISOString().split("T")[0] <= todayStr) setCountsDate(d.toISOString().split("T")[0]);
  }
  const isToday = countsDate === todayStr;
  const countsDateLabel = isToday
    ? "Today"
    : new Date(countsDate + "T12:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short" });

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

  const { data: products } = useQuery<any[]>({
    queryKey: ["products-active"],
    queryFn: () => apiFetch("/products"),
  });

  const { data: dailyCounts } = useQuery<any[]>({
    queryKey: ["daily-counts", countsDate],
    queryFn: () => apiFetch(`/daily-counts?date=${countsDate}`),
    refetchInterval: 60_000,
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

  const calcRevenue = (entries: CountEntry[]) =>
    entries.reduce((s, e) => {
      const sold = e.opening !== undefined && e.closing !== undefined ? Math.max(0, e.opening - e.closing) : 0;
      return s + sold * e.price;
    }, 0);

  const iceCreamRevenue = calcRevenue(iceCreamEntries);
  const juiceRevenue = calcRevenue(juiceEntries);
  const coffeeRevenue = calcRevenue(coffeeEntries);

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
          onClick={() => { refetchStock(); refetchSummary(); qc.invalidateQueries({ queryKey: ["daily-counts"] }); }}
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
              {productionEntries.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View activity log</summary>
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {productionEntries.map((e: any) => (
                      <div key={e.id} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                        <span className="text-muted-foreground">
                          <span className="text-foreground font-medium">{e.recordedBy}</span> — {e.quantity} × {e.productName}
                          {e.notes ? ` (${e.notes})` : ""}
                        </span>
                        <span className="text-muted-foreground ml-3 shrink-0">{formatTime(e.producedAt)}</span>
                      </div>
                    ))}
                  </div>
                </details>
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

      {/* ── ICE CREAM / JUICE / COFFEE COUNTS ── */}
      {(iceCreamEntries.length > 0 || juiceEntries.length > 0 || coffeeEntries.length > 0) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IceCream className="h-4 w-4 text-pink-500" />
                <h2 className="font-semibold">Ice Cream · Juice · Coffee Counts</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={prevDay} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium flex items-center gap-1.5 min-w-[80px] justify-center">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {countsDateLabel}
                </span>
                <button onClick={nextDay} disabled={isToday} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3 bg-muted/30 rounded p-2">
              Enter opening count at the start of the day and closing count at the end. Sold = Opening − Closing.
            </p>

            {iceCreamEntries.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <IceCream className="h-3.5 w-3.5" /> Ice Cream
                </p>
                <div className="space-y-2">
                  {iceCreamEntries.map((e) => (
                    <CountRow key={e.productId} entry={e} onSave={handleSaveCount} isSaving={saveCountMutation.isPending} />
                  ))}
                </div>
              </div>
            )}

            {juiceEntries.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" /> Juice
                </p>
                <div className="space-y-2">
                  {juiceEntries.map((e) => (
                    <CountRow key={e.productId} entry={e} onSave={handleSaveCount} isSaving={saveCountMutation.isPending} />
                  ))}
                </div>
              </div>
            )}

            {coffeeEntries.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5" /> Coffee & Tea
                </p>
                <div className="space-y-2">
                  {coffeeEntries.map((e) => (
                    <CountRow key={e.productId} entry={e} onSave={handleSaveCount} isSaving={saveCountMutation.isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="space-y-1.5 mt-3 pt-3 border-t border-border">
              {iceCreamRevenue > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg text-sm">
                  <span className="flex items-center gap-2 text-pink-700"><IceCream className="h-4 w-4" /> Ice Cream</span>
                  <span className="font-bold text-pink-700">{formatUGX(iceCreamRevenue)}</span>
                </div>
              )}
              {iceCreamEntries.some(e => e.opening !== undefined) && !iceCreamRevenue && (
                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                  <span className="text-blue-600 text-xs flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Ice cream: enter closing count</span>
                </div>
              )}
              {juiceRevenue > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                  <span className="flex items-center gap-2 text-orange-700"><Droplets className="h-4 w-4" /> Juice</span>
                  <span className="font-bold text-orange-700">{formatUGX(juiceRevenue)}</span>
                </div>
              )}
              {coffeeRevenue > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-sm">
                  <span className="flex items-center gap-2 text-amber-700"><Coffee className="h-4 w-4" /> Coffee & Tea</span>
                  <span className="font-bold text-amber-700">{formatUGX(coffeeRevenue)}</span>
                </div>
              )}
              {(iceCreamRevenue + juiceRevenue + coffeeRevenue) > 0 && (
                <div className="flex justify-between items-center px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg font-bold mt-1">
                  <span className="text-sm">Total Counted Sales</span>
                  <span className="text-primary">{formatUGX(iceCreamRevenue + juiceRevenue + coffeeRevenue)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
