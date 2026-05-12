import { useState } from "react";
import { useLocation } from "wouter";
import { useGetDashboardSummary, useGetLowStockItems, useGetRecentActivity, getGetDashboardSummaryQueryKey, getGetLowStockItemsQueryKey, getGetRecentActivityQueryKey, useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Factory, Package, ShoppingCart, Truck, Users, AlertTriangle, TrendingUp, DollarSign, ArrowRight, Phone, MapPin, CreditCard } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  out_for_delivery: "bg-purple-100 text-purple-700 border-purple-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

function StatCard({ title, value, subtitle, icon: Icon, variant = "default", onClick }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "success";
  onClick?: () => void;
}) {
  const colors = { default: "text-primary", warning: "text-amber-600", success: "text-green-600" };
  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow active:scale-95" : ""} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colors[variant]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted ${colors[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {onClick && <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium"><ArrowRight className="h-3 w-3" />View all</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: lowStock } = useGetLowStockItems({ query: { queryKey: getGetLowStockItemsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: allOrders } = useListOrders(undefined, { query: { queryKey: getListOrdersQueryKey() } });

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const recentOrders = allOrders
    ? [...allOrders].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()).slice(0, 8)
    : [];

  const pendingOrders = allOrders?.filter((o) => o.status === "pending") ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Overview for today</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today Revenue" value={formatUGX(summary?.todayTotalRevenue ?? 0)} subtitle="Shop + Online" icon={TrendingUp} variant="success" />
        <StatCard title="Shop Sales" value={formatUGX(summary?.todayShopSales ?? 0)} icon={ShoppingCart} onClick={() => navigate("/pos")} />
        <StatCard title="Online Sales" value={formatUGX(summary?.todayOnlineSales ?? 0)} icon={DollarSign} onClick={() => navigate("/orders")} />
        <StatCard
          title="Pending Orders"
          value={summary?.pendingOrders ?? 0}
          subtitle={summary?.pendingOrders ? "Tap to view" : "All clear"}
          icon={ClipboardList}
          variant={summary?.pendingOrders ? "warning" : "default"}
          onClick={() => navigate("/orders")}
        />
        <StatCard title="Production Today" value={summary?.todayProduction ?? 0} subtitle="Units produced" icon={Factory} onClick={() => navigate("/production")} />
        <StatCard title="Total Stock" value={summary?.totalStockItems ?? 0} subtitle="Units in inventory" icon={Package} onClick={() => navigate("/inventory")} />
        <StatCard title="Low Stock Items" value={summary?.lowStockCount ?? 0} subtitle="Need restocking" icon={AlertTriangle} variant={summary?.lowStockCount ? "warning" : "default"} onClick={() => navigate("/inventory")} />
        <StatCard title="Employees" value={summary?.totalEmployees ?? 0} subtitle={`${summary?.activeRiders ?? 0} riders active`} icon={Users} onClick={() => navigate("/employees")} />
      </div>

      {summary?.outstandingWholesale ? (
        <Card className="border-amber-200 bg-amber-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/wholesale")}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Outstanding Wholesale Balance</p>
              <p className="text-xs text-amber-700">{formatUGX(summary.outstandingWholesale)} owed from business customers</p>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-600 shrink-0" />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Orders — one click to see who ordered what */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                Recent Orders
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => navigate("/orders")}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 px-4">No orders yet</p>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{order.customerName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}>
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {(order as any).items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(", ") || "..."}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(order.placedAt)}</div>
                      </div>
                      <div className="text-sm font-bold text-primary shrink-0">{formatUGX(order.totalAmount)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock + Recent Activity */}
        <div className="space-y-4">
          {lowStock && lowStock.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-medium">{item.productName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{item.currentStock} left</span>
                      <Badge variant="destructive" className="text-xs">Low</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activity?.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 shrink-0 ${
                    item.type === "sale" ? "bg-green-100 text-green-700" :
                    item.type === "order" ? "bg-blue-100 text-blue-700" :
                    item.type === "production" ? "bg-amber-100 text-amber-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {item.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.description}</p>
                    {item.amount && <p className="text-xs text-muted-foreground">{formatUGX(item.amount)}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                  </div>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order detail popup */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Order #{selectedOrder?.id}
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ml-1 ${STATUS_COLORS[selectedOrder?.status] ?? ""}`}>
                {selectedOrder?.status?.replace(/_/g, " ")}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold">{selectedOrder?.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{selectedOrder?.customerPhone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{selectedOrder?.deliveryLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{selectedOrder?.paymentMethod}</span>
                {selectedOrder?.transactionId && <span className="text-xs text-muted-foreground font-mono">({selectedOrder.transactionId})</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items Ordered</p>
              <div className="space-y-2">
                {(selectedOrder as any)?.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{item.productName} <span className="text-muted-foreground font-normal">× {item.quantity}</span></span>
                    <span className="font-semibold">{formatUGX(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between items-center font-bold">
                  <span>Total</span>
                  <span className="text-primary text-base">{formatUGX(selectedOrder?.totalAmount ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)}>Close</Button>
              <Button className="flex-1" onClick={() => { setSelectedOrder(null); navigate("/orders"); }}>
                Manage Orders
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClipboardList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
