import { useState } from "react";
import { useListInventory, useAdjustInventory, getListInventoryQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/auth";

export default function InventoryPage() {
  const { data: inventory, isLoading } = useListInventory({ query: { queryKey: getListInventoryQueryKey() } });
  const adjustMutation = useAdjustInventory();
  const { toast } = useToast();

  const [adjustItem, setAdjustItem] = useState<{ id: number; name: string; current: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    try {
      await adjustMutation.mutateAsync({ productId: adjustItem.id, data: { quantity: parseInt(adjustQty), reason: adjustReason } });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setAdjustItem(null); setAdjustQty(""); setAdjustReason("");
      toast({ title: "Inventory adjusted" });
    } catch {
      toast({ title: "Error", description: "Failed to adjust inventory", variant: "destructive" });
    }
  }

  const lowCount = inventory?.filter((i) => i.isLow).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          {lowCount > 0 && <p className="text-sm text-amber-600 mt-0.5">{lowCount} items need restocking</p>}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Threshold</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Last Updated</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.map((item) => (
                    <tr key={item.id} className={`border-b border-border last:border-0 ${item.isLow ? "bg-amber-50" : "hover:bg-muted/30"}`}>
                      <td className="py-3 px-4 font-medium">{item.productName}</td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${item.isLow ? "text-amber-600" : "text-foreground"}`}>{item.currentStock}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{item.lowStockThreshold}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDateTime(item.lastUpdated)}</td>
                      <td className="py-3 px-4">
                        {item.isLow ? (
                          <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300">OK</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustItem({ id: item.productId, name: item.productName, current: item.currentStock })}
                        >
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!adjustItem} onOpenChange={() => setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjustItem?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <p className="text-sm text-muted-foreground">Current stock: <strong>{adjustItem?.current}</strong></p>
            <div>
              <Label>Quantity change (use negative to reduce)</Label>
              <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. 50 or -10" className="mt-1" required />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Manual recount, damaged goods" className="mt-1" required />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button>
              <Button type="submit" disabled={adjustMutation.isPending}>
                {adjustMutation.isPending ? "Saving..." : "Adjust"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
