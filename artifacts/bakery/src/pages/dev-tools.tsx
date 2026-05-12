import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, RefreshCw, Trash2, Database,
  ShoppingCart, Factory, CalendarDays, Wallet,
  Package, ClipboardList, Users, Bell, CheckCircle2,
} from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.json();
}

type Stats = {
  counts: Record<string, number>;
  totalStock: number;
  kept: string[];
};

const RESET_SCOPES = [
  {
    scope: "production",
    label: "Production Batches",
    icon: Factory,
    color: "orange",
    description: "Clear all production records. Stock levels are NOT affected.",
    tables: ["production"],
  },
  {
    scope: "sales",
    label: "POS Sales",
    icon: ShoppingCart,
    color: "purple",
    description: "Clear all sales transactions and sale line items.",
    tables: ["sales", "sale_items"],
  },
  {
    scope: "counts",
    label: "Daily Counts",
    icon: CalendarDays,
    color: "pink",
    description: "Clear opening/closing counts for ice cream, juice, coffee, milk. Also clears shop receipts.",
    tables: ["daily_counts", "shop_receipts"],
  },
  {
    scope: "orders",
    label: "Orders & Deliveries",
    icon: ClipboardList,
    color: "blue",
    description: "Clear all online orders, order items, and delivery records.",
    tables: ["orders", "order_items", "deliveries"],
  },
  {
    scope: "expenses",
    label: "Expenses",
    icon: Wallet,
    color: "red",
    description: "Clear all recorded expenses.",
    tables: ["expenses"],
  },
  {
    scope: "payments",
    label: "Payments & Wholesale",
    icon: Wallet,
    color: "green",
    description: "Clear MoMo/Airtel payments, salary payments, and wholesale supply records.",
    tables: ["payments", "salary_payments", "wholesale_supplies"],
  },
  {
    scope: "attendance",
    label: "Attendance",
    icon: Users,
    color: "amber",
    description: "Clear all attendance check-in/check-out records.",
    tables: ["attendance"],
  },
  {
    scope: "notifications",
    label: "Notifications",
    icon: Bell,
    color: "slate",
    description: "Clear all notifications and pending approvals.",
    tables: ["notifications", "pending_approvals"],
  },
  {
    scope: "inventory",
    label: "Inventory Stock",
    icon: Package,
    color: "cyan",
    description: "Reset all product stock levels to 0. Product records are kept.",
    tables: ["inventory → set to 0"],
  },
];

function StatBadge({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${highlight ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${highlight ? "text-primary" : value > 0 ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

export default function DevToolsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["dev-stats"],
    queryFn: () => apiFetch("/dev/stats"),
  });

  const resetMutation = useMutation({
    mutationFn: (scope: string) => apiFetch("/dev/reset", { method: "POST", body: JSON.stringify({ scope }) }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["dev-stats"] });
      toast({ title: "Reset complete", description: `Cleared: ${data.cleared.join(", ")}` });
      setConfirming(null);
      setConfirmAll(false);
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
      setConfirming(null);
      setConfirmAll(false);
    },
  });

  const counts = stats?.counts ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Developer Tools
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Admin-only panel. Reset data scopes independently without touching the backend.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Kept / Protected */}
      <Card className="border-green-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-sm">Protected — Never Cleared</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatBadge label="Users / Logins" value={counts["users"] ?? 0} highlight />
            <StatBadge label="Employees" value={counts["employees"] ?? 0} highlight />
            <StatBadge label="Products" value={counts["products"] ?? 0} highlight />
            <StatBadge label="Wholesale Clients" value={counts["wholesale_customers"] ?? 0} highlight />
          </div>
        </CardContent>
      </Card>

      {/* Live counts */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Current Data Snapshot
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatBadge label="Production entries" value={counts["production"] ?? 0} />
            <StatBadge label="Sales" value={counts["sales"] ?? 0} />
            <StatBadge label="Daily counts" value={counts["daily_counts"] ?? 0} />
            <StatBadge label="Shop receipts" value={counts["shop_receipts"] ?? 0} />
            <StatBadge label="Orders" value={counts["orders"] ?? 0} />
            <StatBadge label="Deliveries" value={counts["deliveries"] ?? 0} />
            <StatBadge label="Expenses" value={counts["expenses"] ?? 0} />
            <StatBadge label="Payments" value={counts["payments"] ?? 0} />
            <StatBadge label="Attendance" value={counts["attendance"] ?? 0} />
            <StatBadge label="Salary payments" value={counts["salary_payments"] ?? 0} />
            <StatBadge label="Notifications" value={counts["notifications"] ?? 0} />
            <StatBadge label="Total stock (units)" value={stats?.totalStock ?? 0} />
          </div>
        </CardContent>
      </Card>

      {/* Individual resets */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Reset by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RESET_SCOPES.map((item) => {
            const Icon = item.icon;
            const isConfirming = confirming === item.scope;
            const isPending = resetMutation.isPending && resetMutation.variables === item.scope;

            return (
              <Card key={item.scope} className={isConfirming ? "border-red-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-${item.color}-100 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 text-${item.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{item.label}</p>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.tables.map(t => {
                            const key = t.split(" ")[0];
                            const n = counts[key];
                            return n !== undefined ? `${n} rows` : "";
                          }).filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>

                      {!isConfirming ? (
                        <button
                          className="mt-2 text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-40"
                          disabled={resetMutation.isPending}
                          onClick={() => setConfirming(item.scope)}
                        >
                          <Trash2 className="h-3 w-3" /> Clear {item.label}
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            disabled={isPending}
                            onClick={() => resetMutation.mutate(item.scope)}
                          >
                            {isPending ? "Clearing…" : "Yes, clear it"}
                          </Button>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setConfirming(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Nuclear option — clear everything */}
      <Card className="border-red-300">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-red-700">Reset Everything</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Clears ALL operational data — production, sales, counts, orders, expenses, payments, attendance, notifications — and resets stock to 0.
            Users, employees, and products are <strong>never</strong> touched.
          </p>
          {!confirmAll ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={resetMutation.isPending}
              onClick={() => setConfirmAll(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Reset All Operational Data
            </Button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-medium text-red-700">This cannot be undone. Confirm?</span>
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate("all")}
              >
                {resetMutation.isPending ? "Clearing…" : "Yes, Reset Everything"}
              </Button>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmAll(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
