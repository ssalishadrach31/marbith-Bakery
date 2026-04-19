import { useState } from "react";
import { useListProducts, useListProduction, useCreateProduction, useGetTodayProductionSummary, getListProductionQueryKey, getGetTodayProductionSummaryQueryKey, getListInventoryQueryKey } from "@workspace/api-client-react";
import { formatDateTime } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ProductionPage() {
  const { data: products } = useListProducts();
  const { data: records, isLoading } = useListProduction({ query: { queryKey: getListProductionQueryKey() } });
  const { data: todaySummary } = useGetTodayProductionSummary({ query: { queryKey: getGetTodayProductionSummaryQueryKey() } });
  const createMutation = useCreateProduction();
  const { toast } = useToast();

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const activeProducts = products?.filter((p) => p.isActive) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !quantity) return;
    try {
      await createMutation.mutateAsync({ data: { productId: parseInt(productId), quantity: parseInt(quantity), notes: notes || undefined } });
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTodayProductionSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setProductId(""); setQuantity(""); setNotes("");
      toast({ title: "Production recorded", description: "Inventory updated automatically" });
    } catch {
      toast({ title: "Error", description: "Failed to record production", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Production</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Record New Batch</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId} required>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {activeProducts.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Units produced" className="mt-1" required />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." className="mt-1" rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording..." : "Record Production"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Today's Summary</CardTitle></CardHeader>
          <CardContent>
            {todaySummary && todaySummary.length > 0 ? (
              <div className="space-y-2">
                {todaySummary.map((s) => (
                  <div key={s.productId} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="text-sm font-medium">{s.productName}</span>
                    <span className="text-sm font-bold text-primary">{s.totalProduced} units</span>
                  </div>
                ))}
                <div className="pt-2 flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span className="text-primary">{todaySummary.reduce((a, s) => a + s.totalProduced, 0)} units</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No production recorded today</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Production History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : records && records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Product</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Qty</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice().reverse().slice(0, 30).map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{r.productName}</td>
                      <td className="py-2 px-2 text-primary font-bold">{r.quantity}</td>
                      <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{formatDateTime(r.producedAt)}</td>
                      <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{r.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No production records yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
