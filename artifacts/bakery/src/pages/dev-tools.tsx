import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, RefreshCw, Trash2, Database,
  ShoppingCart, Factory, CalendarDays, Wallet,
  Package, ClipboardList, Users, Bell, CheckCircle2,
  Store, Plus, ToggleLeft, ToggleRight, MapPin, Phone,
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

type Stats = { counts: Record<string, number>; totalStock: number; kept: string[] };

type ShopEmployee = { id: number; name: string; role: string; shopId: number | null };
type ShopRecord = {
  id: number; name: string; location: string; address: string | null;
  phone: string | null; isActive: boolean; createdAt: string;
  employees: ShopEmployee[];
};

const RESET_SCOPES = [
  { scope: "production",    label: "Production Batches",   icon: Factory,     color: "orange", description: "Clear all production records. Stock levels are NOT affected.",                     tables: ["production"] },
  { scope: "sales",         label: "POS Sales",            icon: ShoppingCart,color: "purple", description: "Clear all sales transactions and sale line items.",                              tables: ["sales", "sale_items"] },
  { scope: "counts",        label: "Daily Counts",         icon: CalendarDays,color: "pink",   description: "Clear opening/closing counts and shop receipts.",                                tables: ["daily_counts", "shop_receipts"] },
  { scope: "orders",        label: "Orders & Deliveries",  icon: ClipboardList,color: "blue",  description: "Clear all online orders, order items, and delivery records.",                    tables: ["orders", "order_items", "deliveries"] },
  { scope: "expenses",      label: "Expenses",             icon: Wallet,      color: "red",    description: "Clear all recorded expenses.",                                                   tables: ["expenses"] },
  { scope: "payments",      label: "Payments & Wholesale", icon: Wallet,      color: "green",  description: "Clear MoMo/Airtel payments, salary payments, and wholesale supply records.",     tables: ["payments", "salary_payments", "wholesale_supplies"] },
  { scope: "attendance",    label: "Attendance",           icon: Users,       color: "amber",  description: "Clear all attendance check-in/check-out records.",                              tables: ["attendance"] },
  { scope: "notifications", label: "Notifications",        icon: Bell,        color: "slate",  description: "Clear all notifications and pending approvals.",                                 tables: ["notifications", "pending_approvals"] },
  { scope: "inventory",     label: "Inventory Stock",      icon: Package,     color: "cyan",   description: "Reset all product stock levels to 0. Product records are kept.",                tables: ["inventory → set to 0"] },
];

function StatBadge({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${highlight ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${highlight ? "text-primary" : value > 0 ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

const ALLOWED = "shadrachssali@gmail.com";

export default function DevToolsPage() {
  const currentUser = getUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  if (!currentUser || currentUser.username !== ALLOWED) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-red-700">Access Restricted</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Developer Tools are only accessible to the system developer account.
          This access attempt has been noted.
        </p>
      </div>
    );
  }

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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Developer Tools
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Restricted to system developer only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="data">
        <TabsList className="w-full">
          <TabsTrigger value="data" className="flex-1">Data Management</TabsTrigger>
          <TabsTrigger value="shops" className="flex-1">Shops</TabsTrigger>
        </TabsList>

        {/* ── DATA MANAGEMENT TAB ─────────────────────────────────── */}
        <TabsContent value="data" className="space-y-5 mt-5">
          <Card className="border-green-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-sm">Protected — Never Cleared</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatBadge label="Users / Logins"    value={counts["users"] ?? 0} highlight />
                <StatBadge label="Employees"         value={counts["employees"] ?? 0} highlight />
                <StatBadge label="Products"          value={counts["products"] ?? 0} highlight />
                <StatBadge label="Wholesale Clients" value={counts["wholesale_customers"] ?? 0} highlight />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Current Data Snapshot
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatBadge label="Production entries" value={counts["production"] ?? 0} />
                <StatBadge label="Sales"              value={counts["sales"] ?? 0} />
                <StatBadge label="Daily counts"       value={counts["daily_counts"] ?? 0} />
                <StatBadge label="Shop receipts"      value={counts["shop_receipts"] ?? 0} />
                <StatBadge label="Orders"             value={counts["orders"] ?? 0} />
                <StatBadge label="Deliveries"         value={counts["deliveries"] ?? 0} />
                <StatBadge label="Expenses"           value={counts["expenses"] ?? 0} />
                <StatBadge label="Payments"           value={counts["payments"] ?? 0} />
                <StatBadge label="Attendance"         value={counts["attendance"] ?? 0} />
                <StatBadge label="Salary payments"    value={counts["salary_payments"] ?? 0} />
                <StatBadge label="Notifications"      value={counts["notifications"] ?? 0} />
                <StatBadge label="Total stock (units)"value={stats?.totalStock ?? 0} />
              </div>
            </CardContent>
          </Card>

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
                              {item.tables.map(t => { const k = t.split(" ")[0]; const n = counts[k]; return n !== undefined ? `${n} rows` : ""; }).filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          {!isConfirming ? (
                            <button className="mt-2 text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-40" disabled={resetMutation.isPending} onClick={() => setConfirming(item.scope)}>
                              <Trash2 className="h-3 w-3" /> Clear {item.label}
                            </button>
                          ) : (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                              <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" disabled={isPending} onClick={() => resetMutation.mutate(item.scope)}>
                                {isPending ? "Clearing…" : "Yes, clear it"}
                              </Button>
                              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setConfirming(null)}>Cancel</button>
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

          <Card className="border-red-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="font-semibold text-red-700">Reset Everything</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Clears ALL operational data and resets stock to 0. Users, employees, and products are <strong>never</strong> touched.
              </p>
              {!confirmAll ? (
                <Button variant="destructive" size="sm" disabled={resetMutation.isPending} onClick={() => setConfirmAll(true)} className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Reset All Operational Data
                </Button>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-sm font-medium text-red-700">This cannot be undone. Confirm?</span>
                  <Button variant="destructive" size="sm" className="ml-auto" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate("all")}>
                    {resetMutation.isPending ? "Clearing…" : "Yes, Reset Everything"}
                  </Button>
                  <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setConfirmAll(false)}>Cancel</button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SHOPS TAB ────────────────────────────────────────────── */}
        <TabsContent value="shops" className="mt-5">
          <ShopsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShopsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", address: "", phone: "" });
  const [assigningEmp, setAssigningEmp] = useState<{ empId: number; empName: string } | null>(null);
  const [targetShopId, setTargetShopId] = useState<string>("");

  const { data: shops, isLoading } = useQuery<ShopRecord[]>({
    queryKey: ["dev-shops"],
    queryFn: () => apiFetch("/dev/shops"),
  });

  const createShop = useMutation({
    mutationFn: (body: typeof form) => apiFetch("/dev/shops", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev-shops"] }); setShowForm(false); setForm({ name: "", location: "", address: "", phone: "" }); toast({ title: "Shop added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleShop = useMutation({
    mutationFn: (id: number) => apiFetch(`/dev/shops/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dev-shops"] }),
  });

  const assignEmp = useMutation({
    mutationFn: ({ empId, shopId }: { empId: number; shopId: number | null }) =>
      apiFetch(`/dev/employees/${empId}/shop`, { method: "PATCH", body: JSON.stringify({ shopId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev-shops"] }); setAssigningEmp(null); toast({ title: "Employee shop updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const allEmployees = shops?.flatMap((s) => s.employees) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Store className="h-4 w-4" /> Shop Locations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage shop branches. When you open a new location, add it here so admins can monitor it separately.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Shop
        </Button>
      </div>

      {/* Add shop form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">New Shop Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Shop Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marbith Bakery - Ntinda" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Location / Area *</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ntinda, Kampala" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Full Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, building, landmark" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Shop Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0700 000000" className="mt-1 h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!form.name.trim() || !form.location.trim() || createShop.isPending} onClick={() => createShop.mutate(form)}>
                {createShop.isPending ? "Saving…" : "Save Shop"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shops list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {shops?.map((shop) => (
            <Card key={shop.id} className={!shop.isActive ? "opacity-60 border-dashed" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{shop.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${shop.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {shop.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {shop.location}{shop.address ? ` — ${shop.address}` : ""}</div>
                      {shop.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {shop.phone}</div>}
                    </div>

                    {/* Employees at this shop */}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-foreground/70 mb-1.5">Staff assigned ({shop.employees.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {shop.employees.map((e) => (
                          <span key={e.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">{e.name} <span className="text-muted-foreground">· {e.role}</span></span>
                        ))}
                        {shop.employees.length === 0 && <span className="text-xs text-muted-foreground italic">No staff assigned</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleShop.mutate(shop.id)}
                    disabled={toggleShop.isPending}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title={shop.isActive ? "Deactivate shop" : "Activate shop"}
                  >
                    {shop.isActive
                      ? <ToggleRight className="h-6 w-6 text-green-600" />
                      : <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    }
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign employees section — only shown when there are multiple shops */}
      {(shops?.length ?? 0) > 1 && (
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Reassign Employee to a Different Shop
            </h3>
            <p className="text-xs text-muted-foreground mb-3">When you hire for a new location, move them here.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                value={assigningEmp?.empId ?? ""}
                onChange={(e) => {
                  const emp = allEmployees.find((x) => x.id === parseInt(e.target.value));
                  setAssigningEmp(emp ? { empId: emp.id, empName: emp.name } : null);
                }}
              >
                <option value="">Select employee…</option>
                {allEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select
                className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                value={targetShopId}
                onChange={(e) => setTargetShopId(e.target.value)}
              >
                <option value="">Select shop…</option>
                {shops?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button
                size="sm"
                disabled={!assigningEmp || !targetShopId || assignEmp.isPending}
                onClick={() => assigningEmp && assignEmp.mutate({ empId: assigningEmp.empId, shopId: parseInt(targetShopId) })}
              >
                {assignEmp.isPending ? "Saving…" : "Assign"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Future:</strong> Once you add a second shop, sales, production, and reports will be filterable per shop so each location's performance is tracked separately. For now, everything runs as one shop.
      </div>
    </div>
  );
}
