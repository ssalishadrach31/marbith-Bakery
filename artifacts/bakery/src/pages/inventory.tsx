import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListInventory, useAdjustInventory, getListInventoryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getToken } from "@/lib/auth";
import { Plus, Minus, PackagePlus, PackageMinus, AlertTriangle, History, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type AdjustMode = "in" | "out";

interface AdjLog {
  id: number;
  productId: number;
  productName: string;
  delta: number;
  newStock: number;
  reason: string | null;
  adjustedBy: string;
  adjustedAt: string;
}

const HISTORY_KEY = "/api/inventory/history";

export default function InventoryPage() {
  const qc = useQueryClient();
  const { data: inventory, isLoading } = useListInventory();
  const adjustMutation = useAdjustInventory();
  const { toast } = useToast();

  const [selected, setSelected] = useState<{ id: number; name: string; current: number } | null>(null);
  const [mode, setMode] = useState<AdjustMode>("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: history, isLoading: historyLoading } = useQuery<AdjLog[]>({
    queryKey: [HISTORY_KEY, today],
    queryFn: async () => {
      const token = getToken();
      const r = await fetch(`${API_BASE}/api/inventory/history?date=${today}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: showHistory,
    staleTime: 30_000,
  });

  function openDialog(item: { productId: number; productName: string; currentStock: number }, m: AdjustMode) {
    setSelected({ id: item.productId, name: item.productName, current: item.currentStock });
    setMode(m);
    setQty("");
    setReason("");
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = parseInt(qty);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    const delta = mode === "in" ? amount : -amount;
    try {
      await adjustMutation.mutateAsync({ productId: selected.id, data: { quantity: delta, reason: reason.trim() || (mode === "in" ? "Stock received" : "Manual adjustment") } });
      qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      qc.invalidateQueries({ queryKey: [HISTORY_KEY, today] });
      setSelected(null);
      toast({
        title: mode === "in" ? `Added ${amount} units to ${selected.name}` : `Removed ${amount} units from ${selected.name}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to update stock", variant: "destructive" });
    }
  }

  const lowCount = inventory?.filter((i) => i.isLow).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          {lowCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowCount} item{lowCount > 1 ? "s" : ""} need restocking
            </p>
          )}
        </div>
        <Button
          variant={showHistory ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setShowHistory((v) => !v)}
        >
          <History className="h-4 w-4" />
          {showHistory ? "Hide History" : "Today's History"}
        </Button>
      </div>

      {/* Quick guide */}
      <div className="flex gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <PackagePlus className="h-3.5 w-3.5" />
          <span><strong>Stock In</strong> — delivery arrived</span>
        </div>
        <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <PackageMinus className="h-3.5 w-3.5" />
          <span><strong>Stock Out</strong> — spoilage / recount</span>
        </div>
      </div>

      {/* Adjustment history panel */}
      {showHistory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Today's Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No adjustments recorded today</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                    {log.delta > 0
                      ? <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />
                      : <ArrowDownCircle className="h-4 w-4 text-red-500 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{log.productName}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${log.delta > 0 ? "border-green-300 text-green-700 bg-green-50" : "border-red-300 text-red-700 bg-red-50"}`}
                        >
                          {log.delta > 0 ? `+${log.delta}` : log.delta} → {log.newStock} units
                        </Badge>
                      </div>
                      {log.reason && <div className="text-xs text-muted-foreground mt-0.5">{log.reason}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">{log.adjustedBy}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(log.adjustedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inventory list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {inventory?.map((item) => (
            <Card key={item.id} className={item.isLow ? "border-amber-300" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.productName}</span>
                      {item.isLow && (
                        <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>
                        Stock: <strong className={item.isLow ? "text-amber-600" : "text-foreground"}>{item.currentStock}</strong>
                      </span>
                      {item.lowStockThreshold > 0 && <span>Min: {item.lowStockThreshold}</span>}
                      <span className="hidden sm:inline">Updated: {formatDateTime(item.lastUpdated)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openDialog(item, "in")}
                      className="flex items-center gap-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> In
                    </button>
                    <button
                      onClick={() => openDialog(item, "out")}
                      className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" /> Out
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!inventory || inventory.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-10">No inventory items found</p>
          )}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === "in"
                ? <><PackagePlus className="h-5 w-5 text-green-600" /> Stock In — {selected?.name}</>
                : <><PackageMinus className="h-5 w-5 text-red-500" /> Stock Out — {selected?.name}</>
              }
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className={`text-sm rounded-lg px-4 py-3 ${mode === "in" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {mode === "in"
                ? "Use this when a delivery of stock arrives at the shop."
                : "Use this to correct stock after a recount or remove spoiled/damaged items."
              }
            </div>
            <p className="text-sm text-muted-foreground">
              Current stock: <strong>{selected?.current}</strong>
            </p>
            <div>
              <Label>Quantity {mode === "in" ? "received" : "to remove"}</Label>
              <Input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 24"
                className="mt-1"
                required
                autoFocus
              />
            </div>
            <div>
              <Label>Reason / Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={mode === "in" ? "e.g. Delivery from supplier" : "e.g. Expired, damaged"}
                className="mt-1"
              />
            </div>
            {qty && parseInt(qty) > 0 && (
              <p className="text-xs text-muted-foreground">
                New stock will be: <strong className="text-foreground">{mode === "in"
                  ? (selected?.current ?? 0) + parseInt(qty)
                  : Math.max(0, (selected?.current ?? 0) - parseInt(qty))
                }</strong>
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              <Button
                type="submit"
                disabled={adjustMutation.isPending || !qty || parseInt(qty) <= 0}
                className={mode === "in" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                {adjustMutation.isPending ? "Saving…" : mode === "in" ? "Add to Stock" : "Remove from Stock"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
