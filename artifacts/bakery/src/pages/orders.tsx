import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, useListRiders, useAssignDelivery, getListOrdersQueryKey, getListDeliveriesQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  out_for_delivery: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["pending", "confirmed", "out_for_delivery", "delivered", "cancelled"];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: orders, isLoading } = useListOrders(statusFilter !== "all" ? { status: statusFilter } : undefined, { query: { queryKey: getListOrdersQueryKey() } });
  const { data: riders } = useListRiders();
  const updateStatus = useUpdateOrderStatus();
  const assignDelivery = useAssignDelivery();
  const { toast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<NonNullable<typeof orders>[0] | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [riderId, setRiderId] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("2000");

  async function handleStatusUpdate() {
    if (!selectedOrder || !newStatus) return;
    try {
      await updateStatus.mutateAsync({ id: selectedOrder.id, data: { status: newStatus as any } });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setSelectedOrder(null);
      toast({ title: "Order status updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }

  async function handleAssign() {
    if (!assignModal || !riderId) return;
    try {
      await assignDelivery.mutateAsync({ id: assignModal, data: { riderId: parseInt(riderId), deliveryFee: parseFloat(deliveryFee) } });
      await updateStatus.mutateAsync({ id: assignModal, data: { status: "confirmed" } });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
      setAssignModal(null); setRiderId(""); setDeliveryFee("2000");
      toast({ title: "Order assigned to rider" });
    } catch {
      toast({ title: "Error", description: "Failed to assign delivery", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Online Orders</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}</div>
          ) : orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice().reverse().map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono text-muted-foreground">#{order.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{order.deliveryLocation}</td>
                      <td className="py-3 px-4 font-bold text-primary">{formatUGX(order.totalAmount)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{formatDateTime(order.placedAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order as any); setNewStatus(order.status); }}>Update</Button>
                          {order.status === "confirmed" && (
                            <Button size="sm" variant="outline" onClick={() => setAssignModal(order.id)}>Assign</Button>
                          )}
                          {order.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => setAssignModal(order.id)}>Assign Rider</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No orders found</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold">{selectedOrder?.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span>{selectedOrder?.customerPhone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span>{selectedOrder?.deliveryLocation}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span>{selectedOrder?.paymentMethod}</span>
              </div>
            </div>
            {/* Items ordered */}
            {(selectedOrder as any)?.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items Ordered</p>
                <div className="space-y-1.5">
                  {(selectedOrder as any).items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-border pb-1.5 last:border-0">
                      <span>{item.productName} <span className="text-muted-foreground">× {item.quantity}</span></span>
                      <span className="font-medium">{formatUGX(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-sm font-bold pt-1">
                    <span>Total</span>
                    <span className="text-primary">{formatUGX(selectedOrder?.totalAmount ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Status update */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Update Status</p>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Button>
              <Button onClick={handleStatusUpdate} disabled={updateStatus.isPending}>Update Status</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignModal} onOpenChange={() => setAssignModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign to Rider</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rider</Label>
              <Select value={riderId} onValueChange={setRiderId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select rider" /></SelectTrigger>
                <SelectContent>
                  {riders?.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.phone})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery Fee (UGX)</Label>
              <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssignModal(null)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={assignDelivery.isPending || !riderId}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
