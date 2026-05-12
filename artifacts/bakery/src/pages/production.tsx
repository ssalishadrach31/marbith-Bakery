import { useState } from "react";
import { useListProducts, useCreateProduction, getListProductionQueryKey, getGetTodayProductionSummaryQueryKey, getListInventoryQueryKey, useListProduction } from "@workspace/api-client-react";
import { formatDateTime, getUser } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sunrise, ChefHat, Moon, History } from "lucide-react";

type EntryType = "leftover" | "new_batch" | "closing";

const ENTRY_TYPES: { type: EntryType; label: string; desc: string; icon: React.ReactNode; cardClass: string; badgeClass: string }[] = [
  {
    type: "leftover",
    label: "Yesterday's Leftover",
    desc: "Unsold items carried over from yesterday morning",
    icon: <Sunrise className="h-5 w-5" />,
    cardClass: "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-300",
  },
  {
    type: "new_batch",
    label: "New Batch (Chef)",
    desc: "Fresh production added by the kitchen today",
    icon: <ChefHat className="h-5 w-5" />,
    cardClass: "border-green-300 bg-green-50 hover:bg-green-100 text-green-800",
    badgeClass: "bg-green-100 text-green-700 border-green-300",
  },
  {
    type: "closing",
    label: "Evening Closing Stock",
    desc: "Count remaining items at end of day — sets the stock",
    icon: <Moon className="h-5 w-5" />,
    cardClass: "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300",
  },
];

const todayStr = new Date().toISOString().split("T")[0];

export default function ProductionPage() {
  const { data: products } = useListProducts();
  const { data: records, isLoading } = useListProduction(
    { date: todayStr },
    { query: { queryKey: getListProductionQueryKey({ date: todayStr }) } }
  );
  const createMutation = useCreateProduction();
  const { toast } = useToast();

  const [activeType, setActiveType] = useState<EntryType | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const activeProducts = products?.filter((p) => p.isActive) ?? [];

  function openForm(type: EntryType) {
    setActiveType(type);
    setProductId("");
    setQuantity("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeType || !productId || !quantity) return;
    try {
      await createMutation.mutateAsync({
        data: { productId: parseInt(productId), quantity: parseInt(quantity), entryType: activeType, notes: notes || undefined },
      });
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey({ date: todayStr }) });
      queryClient.invalidateQueries({ queryKey: getGetTodayProductionSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      const meta = ENTRY_TYPES.find((t) => t.type === activeType)!;
      setActiveType(null);
      setProductId(""); setQuantity(""); setNotes("");
      toast({ title: "Recorded", description: `${meta.label} saved — inventory updated` });
    } catch {
      toast({ title: "Error", description: "Failed to record entry", variant: "destructive" });
    }
  }

  // Build today's per-product summary from raw log
  const summaryMap = new Map<number, { name: string; leftover: number; newBatch: number; closing: number }>();
  for (const r of records ?? []) {
    if (!summaryMap.has(r.productId))
      summaryMap.set(r.productId, { name: r.productName, leftover: 0, newBatch: 0, closing: 0 });
    const entry = summaryMap.get(r.productId)!;
    if (r.entryType === "leftover") entry.leftover += r.quantity;
    else if (r.entryType === "new_batch") entry.newBatch += r.quantity;
    else if (r.entryType === "closing") entry.closing = r.quantity;
  }

  const getMeta = (type: string) => ENTRY_TYPES.find((t) => t.type === type);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Production</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Record daily stock — morning opening entries and evening closing count</p>
      </div>

      {/* Entry type selector */}
      {!activeType && (
        <div className="grid sm:grid-cols-3 gap-4">
          {ENTRY_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => openForm(t.type)}
              className={`flex flex-col items-start gap-2 p-5 rounded-xl border-2 transition-colors text-left ${t.cardClass}`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                {t.icon}
                {t.label}
              </div>
              <p className="text-xs opacity-70">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Active entry form */}
      {activeType && (() => {
        const meta = getMeta(activeType)!;
        return (
          <Card className={`border-2 ${meta.cardClass.split(" ").slice(0, 2).join(" ")}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {meta.icon}
                  {meta.label}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveType(null)}>Cancel</Button>
              </div>
              {activeType === "closing" && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  This sets the inventory to the exact count you enter — use this at end of day.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Product</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{activeType === "closing" ? "Count remaining" : "Quantity"}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={activeType === "closing" ? "How many are left?" : "Number of units"}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." className="mt-1" rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Entry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })()}

      {/* Today's per-product summary table */}
      {summaryMap.size > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Today's Stock Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Product</th>
                    <th className="text-center py-2.5 px-3 font-medium text-amber-600">Leftover</th>
                    <th className="text-center py-2.5 px-3 font-medium text-green-600">New Batch</th>
                    <th className="text-center py-2.5 px-3 font-medium text-foreground">Opening</th>
                    <th className="text-center py-2.5 px-3 font-medium text-blue-600">Closing</th>
                    <th className="text-center py-2.5 px-3 font-medium text-primary">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(summaryMap.values()).map((row) => {
                    const opening = row.leftover + row.newBatch;
                    const sold = row.closing > 0 ? Math.max(0, opening - row.closing) : null;
                    return (
                      <tr key={row.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-medium">{row.name}</td>
                        <td className="py-2.5 px-3 text-center text-amber-600">{row.leftover || "—"}</td>
                        <td className="py-2.5 px-3 text-center text-green-600">{row.newBatch || "—"}</td>
                        <td className="py-2.5 px-3 text-center font-semibold">{opening || "—"}</td>
                        <td className="py-2.5 px-3 text-center text-blue-600">{row.closing || "—"}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-primary">{sold !== null ? sold : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's entry log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Today's Entry Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : records && records.length > 0 ? (
            <div className="divide-y divide-border">
              {[...records].reverse().map((r) => {
                const meta = getMeta(r.entryType);
                return (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <Badge variant="outline" className={`text-xs shrink-0 ${meta?.badgeClass ?? ""}`}>
                      {meta?.label ?? r.entryType}
                    </Badge>
                    <span className="font-medium text-sm flex-1">{r.productName}</span>
                    <span className="text-sm font-bold text-primary">{r.quantity}</span>
                    <span className="text-xs text-muted-foreground hidden sm:block">{r.recordedBy}</span>
                    <span className="text-xs text-muted-foreground hidden md:block">{formatDateTime(r.producedAt)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No entries recorded today yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
