import { useListDeliveries, useUpdateDeliveryStatus, getListDeliveriesQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-700",
  picked_up: "bg-yellow-100 text-yellow-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const DELIVERY_STATUSES = ["assigned", "picked_up", "delivered", "failed"];

export default function DeliveriesPage() {
  const { data: deliveries, isLoading } = useListDeliveries(undefined, { query: { queryKey: getListDeliveriesQueryKey() } });
  const updateStatus = useUpdateDeliveryStatus();
  const { toast } = useToast();

  const [selected, setSelected] = useState<NonNullable<typeof deliveries>[0] | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [feeCollected, setFeeCollected] = useState(false);

  async function handleUpdate() {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({ id: selected.id, data: { status: newStatus as any, feeCollected } });
      queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
      setSelected(null);
      toast({ title: "Delivery updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update delivery", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Deliveries</h1>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}</div>
          ) : deliveries && deliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Rider</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Fee</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Fee Paid</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono text-muted-foreground">#{d.orderId}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{d.customerName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-32">{d.deliveryLocation}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{d.riderName ?? "Unassigned"}</td>
                      <td className="py-3 px-4 font-medium hidden md:table-cell">{formatUGX(d.deliveryFee)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[d.status] ?? "bg-muted text-muted-foreground"}`}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        {d.feeCollected ? <Badge className="bg-green-100 text-green-700 text-xs">Collected</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => { setSelected(d as any); setNewStatus(d.status); setFeeCollected(d.feeCollected); }}>
                          Update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No deliveries yet</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Order #{selected?.orderId} — {selected?.customerName}</p>
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="fee" checked={feeCollected} onCheckedChange={setFeeCollected} />
              <Label htmlFor="fee">Delivery fee collected</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={updateStatus.isPending}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
