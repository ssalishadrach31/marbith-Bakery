import { useListDeliveries, useUpdateDeliveryStatus, getListDeliveriesQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime, getUser } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-700",
  picked_up: "bg-yellow-100 text-yellow-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function RiderDeliveriesPage() {
  const user = getUser();
  const { data: deliveries, isLoading } = useListDeliveries({ params: user?.employeeId ? { riderId: user.employeeId } : {}, query: { queryKey: getListDeliveriesQueryKey() } });
  const updateStatus = useUpdateDeliveryStatus();
  const { toast } = useToast();

  const [selected, setSelected] = useState<typeof deliveries extends (infer T)[] | undefined ? T : never | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [feeCollected, setFeeCollected] = useState(false);

  async function handleUpdate() {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({ id: selected.id, data: { status: newStatus as any, feeCollected } });
      queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
      setSelected(null);
      toast({ title: "Delivery updated" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  const active = deliveries?.filter((d) => d.status !== "delivered" && d.status !== "failed") ?? [];
  const completed = deliveries?.filter((d) => d.status === "delivered" || d.status === "failed") ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Deliveries</h1>

      <div className="grid gap-4">
        {active.map((d) => (
          <Card key={d.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{d.customerName}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{d.deliveryLocation}</div>
                  <div className="text-sm text-muted-foreground">Order #{d.orderId}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">Fee: {formatUGX(d.deliveryFee)}</span>
                    {d.feeCollected && <Badge className="bg-green-100 text-green-700 text-xs">Fee Collected</Badge>}
                  </div>
                </div>
                <Button size="sm" onClick={() => { setSelected(d as any); setNewStatus(d.status); setFeeCollected(d.feeCollected); }}>
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {active.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No active deliveries assigned to you</p>
            </CardContent>
          </Card>
        )}

        {completed.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Completed</h2>
            {completed.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{d.customerName}</div>
                  <div className="text-xs text-muted-foreground">{d.deliveryLocation}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Delivery Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-medium">{selected?.customerName}</p>
            <p className="text-sm text-muted-foreground">{selected?.deliveryLocation}</p>
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["assigned", "picked_up", "delivered", "failed"].map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="fee2" checked={feeCollected} onCheckedChange={setFeeCollected} />
              <Label htmlFor="fee2">Delivery fee collected ({formatUGX(selected?.deliveryFee ?? 0)})</Label>
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
