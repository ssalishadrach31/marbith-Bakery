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
  Clock, User, RefreshCw, CheckCircle2,
  Truck, ChevronRight, Plus, Users,
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

  // Build receipt vs sold vs remaining per product for accountability table
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
          onClick={() => refetch()}
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
            {/* Production log */}
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
        <Card className={!hasProduction ? "opacity-60" : ""}>
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
                      <th className="text-right py-2 text-muted-foreground font-medium">Received</th>
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

            {/* Receipt log */}
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
                        {(products ?? []).filter((p: any) => p.isActive).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantity received</label>
                    <Input
                      type="number"
                      min="1"
                      value={receiptForm.quantityReceived}
                      onChange={(e) => setReceiptForm({ ...receiptForm, quantityReceived: e.target.value })}
                      placeholder="e.g. 50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                  <Input
                    value={receiptForm.notes}
                    onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                    placeholder="e.g. 5 were broken"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!receiptForm.productId || !receiptForm.quantityReceived || addReceiptMutation.isPending}
                    onClick={() => addReceiptMutation.mutate({ productId: Number(receiptForm.productId), quantityReceived: Number(receiptForm.quantityReceived), notes: receiptForm.notes || undefined })}
                  >
                    {addReceiptMutation.isPending ? "Saving..." : "Confirm Receipt"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowReceiptForm(false); setReceiptForm({ productId: "", quantityReceived: "", notes: "" }); }}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: SALES TODAY ── */}
      {showSales && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</div>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
              <h2 className="font-semibold">Sales Today</h2>
              <span className="ml-auto text-sm font-bold text-primary">{formatUGX(sales.totalRevenue)}</span>
            </div>

            {sales.byProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales recorded yet today</p>
            ) : (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Units Sold</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.byProduct.map((p: any) => (
                      <tr key={p.productId} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium">{p.productName}</td>
                        <td className="py-2 text-right">{p.qtySold}</td>
                        <td className="py-2 text-right font-semibold text-purple-700">{formatUGX(p.revenue)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2 text-sm">Total</td>
                      <td className="py-2 text-right text-sm">{sales.totalSoldUnits}</td>
                      <td className="py-2 text-right text-primary">{formatUGX(sales.totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Sales log */}
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

      {/* ── STEP 4: END OF DAY — STOCK & CASHIER ACCOUNTABILITY ── */}
      <Card className="border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">End of Day — Cashier Accountability</h2>
          </div>

          {/* Per cashier */}
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

              {/* Combined total */}
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 mt-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">Combined Total ({accountability.cashiers.length} cashier{accountability.cashiers.length !== 1 ? "s" : ""})</span>
                </div>
                <span className="font-bold text-primary text-lg">{formatUGX(accountability.combinedRevenue)}</span>
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
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Stock Value</th>
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
              <p className="text-xs text-muted-foreground mt-2">Remaining stock value = <span className="font-semibold">{formatUGX(inventory.reduce((s: number, i: any) => s + i.stockValue, 0))}</span></p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
