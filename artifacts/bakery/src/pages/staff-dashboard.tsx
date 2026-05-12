import { useQuery } from "@tanstack/react-query";
import { getToken, getUser, formatUGX, formatTime } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Factory, ShoppingCart, Package, Wallet,
  TrendingUp, Clock, User, RefreshCw,
} from "lucide-react";

async function fetchStaffDashboard() {
  const token = getToken();
  const res = await fetch("/api/staff-dashboard", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${color} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="text-lg font-bold leading-tight mt-0.5 truncate">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffDashboardPage() {
  const user = getUser();
  const today = new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: fetchStaffDashboard,
    refetchInterval: 60_000,
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

  const { production, sales, inventory, summary } = data;

  const role = user?.role;
  const showProduction = role === "admin" || role === "staff" || role === "baker";
  const showSales = role === "admin" || role === "staff" || role === "cashier";

  return (
    <div className="space-y-6">
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

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-primary" />
          <span className="font-semibold text-primary">{user?.name}</span>
          {user?.jobTitle && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{user.jobTitle}</span>}
        </div>
        <p className="text-sm text-muted-foreground">Here's everything recorded at Marbith Bakery today.</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {showProduction && (
          <StatCard
            icon={Factory}
            label="Produced Today"
            value={production.byProduct.reduce((s: number, p: any) => s + p.totalProduced, 0).toString() + " units"}
            sub={`${production.byProduct.length} product types`}
            color="bg-orange-100 text-orange-700"
          />
        )}
        {showSales && (
          <StatCard
            icon={ShoppingCart}
            label="Items Sold"
            value={sales.byProduct.reduce((s: number, p: any) => s + p.qtySold, 0).toString() + " units"}
            sub={`${sales.transactionCount} transactions`}
            color="bg-blue-100 text-blue-700"
          />
        )}
        <StatCard
          icon={Package}
          label="Stock Remaining"
          value={inventory.reduce((s: number, i: any) => s + i.currentStock, 0).toString() + " units"}
          sub={`across ${inventory.filter((i: any) => i.currentStock > 0).length} products`}
          color="bg-green-100 text-green-700"
        />
        {showSales && (
          <StatCard
            icon={Wallet}
            label="Money Collected"
            value={formatUGX(sales.totalRevenue)}
            sub={`${sales.transactionCount} sales today`}
            color="bg-purple-100 text-purple-700"
          />
        )}
      </div>

      {/* Accountability summary for cashiers */}
      {showSales && sales.byPerson.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Sales by Staff — End of Day Accountability</h2>
            </div>
            <div className="space-y-3">
              {sales.byPerson.map((person: any) => (
                <div key={person.soldBy} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {person.soldBy.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{person.soldBy}</div>
                      <div className="text-xs text-muted-foreground">{person.transactions} transaction{person.transactions !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{formatUGX(person.totalAmount)}</div>
                    <div className="text-xs text-muted-foreground">expected at end of shift</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* What was sold today (by product) */}
        {showSales && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <h2 className="font-semibold">Sold Today (by Product)</h2>
              </div>
              {sales.byProduct.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No sales recorded yet today</p>
              ) : (
                <div className="space-y-2">
                  {sales.byProduct.map((p: any) => (
                    <div key={p.productId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="text-sm font-medium">{p.productName}</span>
                        <span className="text-xs text-muted-foreground ml-2">× {p.qtySold} units</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-700">{formatUGX(p.revenue)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold text-sm border-t border-border mt-1">
                    <span>Total</span>
                    <span className="text-primary">{formatUGX(sales.totalRevenue)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* What was produced today */}
        {showProduction && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Factory className="h-4 w-4 text-orange-600" />
                <h2 className="font-semibold">Produced Today</h2>
              </div>
              {production.byProduct.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No production recorded yet today</p>
              ) : (
                <div className="space-y-2">
                  {production.byProduct.map((p: any) => (
                    <div key={p.productId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm font-medium">{p.productName}</span>
                      <span className="text-sm font-semibold text-orange-700">{p.totalProduced} units</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold text-sm border-t border-border mt-1">
                    <span>Total units</span>
                    <span className="text-orange-700">{production.byProduct.reduce((s: number, p: any) => s + p.totalProduced, 0)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stock remaining */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-green-600" />
              <h2 className="font-semibold">Stock Remaining Now</h2>
            </div>
            {inventory.filter((i: any) => i.currentStock > 0).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No stock on hand</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventory
                  .filter((i: any) => i.currentStock > 0)
                  .sort((a: any, b: any) => b.currentStock - a.currentStock)
                  .map((i: any) => (
                    <div key={i.productId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm font-medium">{i.productName}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-green-700">{i.currentStock} units</span>
                        <span className="text-xs text-muted-foreground ml-2">= {formatUGX(i.stockValue)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity log — who did what and when */}
      {production.entries.length > 0 && showProduction && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Production Activity Log</h2>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {production.entries.map((e: any) => (
                <div key={e.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{e.productName} <span className="text-muted-foreground font-normal">× {e.quantity}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Recorded by <span className="font-medium text-foreground">{e.recordedBy}</span>
                      {e.notes && <span> · {e.notes}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(e.producedAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales activity log */}
      {sales.transactions.length > 0 && showSales && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Sales Activity Log</h2>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...sales.transactions].reverse().map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{formatUGX(t.totalAmount)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      By <span className="font-medium text-foreground">{t.soldBy}</span>
                      {" · "}{t.itemCount} item{t.itemCount !== 1 ? "s" : ""}
                      {" · "}{t.paymentMethod === "cash" ? "Cash" : t.paymentMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(t.soldAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
