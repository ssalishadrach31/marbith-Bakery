import { useGetDashboardSummary, useGetLowStockItems, useGetRecentActivity, getGetDashboardSummaryQueryKey, getGetLowStockItemsQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Package, ShoppingCart, Truck, Users, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

function StatCard({ title, value, subtitle, icon: Icon, variant = "default" }: {
  title: string; value: string | number; subtitle?: string; icon: React.ComponentType<{ className?: string }>; variant?: "default" | "warning" | "success";
}) {
  const colors = {
    default: "text-primary",
    warning: "text-amber-600",
    success: "text-green-600",
  };
  return (
    <Card>
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
      </CardContent>
    </Card>
  );
}

const activityColors: Record<string, string> = {
  sale: "bg-green-100 text-green-700",
  order: "bg-blue-100 text-blue-700",
  production: "bg-amber-100 text-amber-700",
  delivery: "bg-purple-100 text-purple-700",
  wholesale: "bg-orange-100 text-orange-700",
};

export default function DashboardPage() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: lowStock } = useGetLowStockItems({ query: { queryKey: getGetLowStockItemsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
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
        <StatCard title="Shop Sales" value={formatUGX(summary?.todayShopSales ?? 0)} icon={ShoppingCart} />
        <StatCard title="Online Sales" value={formatUGX(summary?.todayOnlineSales ?? 0)} icon={DollarSign} />
        <StatCard title="Pending Orders" value={summary?.pendingOrders ?? 0} subtitle="Needs attention" icon={ClipboardList} variant={summary?.pendingOrders ? "warning" : "default"} />
        <StatCard title="Production Today" value={summary?.todayProduction ?? 0} subtitle="Units produced" icon={Factory} />
        <StatCard title="Total Stock" value={summary?.totalStockItems ?? 0} subtitle="Units in inventory" icon={Package} />
        <StatCard title="Low Stock Items" value={summary?.lowStockCount ?? 0} subtitle="Need restocking" icon={AlertTriangle} variant={summary?.lowStockCount ? "warning" : "default"} />
        <StatCard title="Employees" value={summary?.totalEmployees ?? 0} subtitle={`${summary?.activeRiders ?? 0} riders active`} icon={Users} />
      </div>

      {summary?.outstandingWholesale ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Outstanding Wholesale Balance</p>
              <p className="text-xs text-amber-700">{formatUGX(summary.outstandingWholesale)} owed from business customers</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        {lowStock && lowStock.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lowStock.slice(0, 6).map((item) => (
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
            {activity?.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${activityColors[item.type] ?? "bg-muted text-muted-foreground"}`}>
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
  );
}

function ClipboardList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
