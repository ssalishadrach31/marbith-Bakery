import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, RefreshCw, Trash2, Database,
  ShoppingCart, Factory, CalendarDays, Wallet,
  Package, ClipboardList, Users, Bell, CheckCircle2,
  Store, Plus, ToggleLeft, ToggleRight, MapPin, Phone, Tag,
  Eye, EyeOff, Save, Palette, KeyRound, ShieldCheck,
  Bot, Send, MessageSquare, Loader2, PlusCircle, X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); const err: any = new Error(e.error ?? "Request failed"); err.status = res.status; throw err; }
  return res.status === 204 ? null : res.json();
}

type Stats = { counts: Record<string, number>; totalStock: number; kept: string[] };
type MyPerms = { isDeveloper: boolean; permissions: string[] };

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

const DEVELOPER_EMAIL = "shadrachssali@gmail.com";

export default function DevToolsPage() {
  const currentUser = getUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const isDeveloper = currentUser?.username === DEVELOPER_EMAIL;

  const { data: myPerms } = useQuery<MyPerms>({
    queryKey: ["dev-my-permissions"],
    queryFn: () => apiFetch("/dev/my-permissions"),
    enabled: isAdmin,
  });

  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["dev-stats"],
    queryFn: () => apiFetch("/dev/stats"),
    enabled: isAdmin,
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

  // Block non-admins
  if (!currentUser || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-red-700">Access Restricted</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Developer Tools are only accessible to admin accounts.
        </p>
      </div>
    );
  }

  function hasPermission(perm: string) {
    return isDeveloper || (myPerms?.permissions ?? []).includes(perm);
  }

  const counts = stats?.counts ?? {};

  // Build visible tab list dynamically
  const visibleTabs = [
    { value: "data", label: "Data" },
    { value: "prices", label: "Prices" },
    ...(hasPermission("manage_shops") ? [{ value: "shops", label: "Shops" }] : []),
    { value: "branding", label: "Branding" },
    ...(hasPermission("view_passwords") ? [{ value: "passwords", label: "Passwords" }] : []),
    ...(isDeveloper ? [{ value: "permissions", label: "Permissions" }] : []),
    ...(isDeveloper ? [{ value: "ai", label: "AI Assistant" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Developer Tools
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isDeveloper ? "Full access — system developer." : "Admin access — limited to data management."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="data">
        <TabsList
          className="w-full grid"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">{tab.label}</TabsTrigger>
          ))}
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

        {/* ── PRICES TAB ───────────────────────────────────────────── */}
        <TabsContent value="prices" className="mt-5">
          <PricesPanel />
        </TabsContent>

        {/* ── SHOPS TAB ────────────────────────────────────────────── */}
        {hasPermission("manage_shops") && (
          <TabsContent value="shops" className="mt-5">
            <ShopsPanel />
          </TabsContent>
        )}

        {/* ── BRANDING TAB ─────────────────────────────────────────── */}
        <TabsContent value="branding" className="mt-5">
          <BrandingPanel />
        </TabsContent>

        {/* ── PASSWORDS TAB ────────────────────────────────────────── */}
        {hasPermission("view_passwords") && (
          <TabsContent value="passwords" className="mt-5">
            <PasswordsPanel />
          </TabsContent>
        )}

        {/* ── PERMISSIONS TAB — Shadrach only ──────────────────────── */}
        {isDeveloper && (
          <TabsContent value="permissions" className="mt-5">
            <PermissionsPanel />
          </TabsContent>
        )}
        {isDeveloper && (
          <TabsContent value="ai" className="mt-5">
            <AIChatPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PricesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ["dev-products"],
    queryFn: () => apiFetch("/products?includeInactive=true"),
  });

  const updatePrice = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) =>
      apiFetch(`/products/${id}`, { method: "PUT", body: JSON.stringify({ price }) }),
    onSuccess: (updated: any) => {
      qc.setQueryData(["dev-products"], (old: any[] | undefined) =>
        (old ?? []).map((p) => (p.id === updated.id ? { ...p, price: updated.price } : p))
      );
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setEditingId(null);
      toast({ title: "Price updated", description: `${updated.name}: ${updated.price.toLocaleString()} UGX` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function savePrice(id: number) {
    const price = parseInt(editPrice);
    if (!isNaN(price) && price > 0) updatePrice.mutate({ id, price });
  }

  const categories: string[] = [...new Set((products ?? []).map((p: any) => p.category as string))].sort();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">
          Update the selling price of any product. Changes take effect immediately in POS and daily counts.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      ) : (
        categories.map((cat) => {
          const catProducts = (products ?? []).filter((p: any) => p.category === cat);
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat.replace(/_/g, " ")}
                </h3>
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Product</th>
                        <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Current Price</th>
                        <th className="py-2.5 px-3 w-28" />
                      </tr>
                    </thead>
                    <tbody>
                      {catProducts.map((product: any) => (
                        <tr key={product.id} className="border-t border-border hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">
                            {product.name}
                            {!product.isActive && <span className="ml-2 text-xs text-muted-foreground italic">(inactive)</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {editingId === product.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-7 w-24 text-right text-sm p-1"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") savePrice(product.id);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  autoFocus
                                />
                                <span className="text-xs text-muted-foreground shrink-0">UGX</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-primary">{product.price.toLocaleString()} UGX</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {editingId === product.id ? (
                              <div className="flex gap-1 justify-end">
                                <button
                                  className="w-7 h-7 flex items-center justify-center bg-green-600 text-white rounded font-bold text-sm"
                                  onClick={() => savePrice(product.id)}
                                  disabled={updatePrice.isPending}
                                >✓</button>
                                <button
                                  className="w-7 h-7 flex items-center justify-center border border-border rounded text-sm text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditingId(null)}
                                >✕</button>
                              </div>
                            ) : (
                              <button
                                className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors text-muted-foreground"
                                onClick={() => { setEditingId(product.id); setEditPrice(String(product.price)); }}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          );
        })
      )}
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
        <strong>Future:</strong> Once you add a second shop, sales, production, and reports will be filterable per shop so each location's performance is tracked separately.
      </div>
    </div>
  );
}

const BRAND_KEY = "marbith_branding";
const FONT_DEFAULT_SENTINEL = "__default__";
const FONTS = [
  { value: FONT_DEFAULT_SENTINEL, label: "Default (system-ui)" },
  { value: "'Georgia', serif", label: "Georgia — elegant serif" },
  { value: "Verdana, sans-serif", label: "Verdana — clean & readable" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS — modern" },
  { value: "'Arial', sans-serif", label: "Arial — classic" },
  { value: "'Courier New', monospace", label: "Courier New — typewriter" },
];

function BrandingPanel() {
  const { toast } = useToast();
  function load() {
    try { const r = localStorage.getItem(BRAND_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
  }
  const [b, setB] = useState<Record<string, string>>(load);

  function save() {
    localStorage.setItem(BRAND_KEY, JSON.stringify(b));
    if (b.font) document.documentElement.style.fontFamily = b.font;
    else document.documentElement.style.fontFamily = "";
    toast({ title: "Branding saved", description: "Changes applied. The sidebar name updates after the next page load." });
  }

  function reset() {
    localStorage.removeItem(BRAND_KEY);
    setB({});
    document.documentElement.style.fontFamily = "";
    toast({ title: "Branding reset to defaults" });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Customize the bakery name, tagline, and font shown across the management system. Changes are saved on this device and apply immediately.
      </p>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">App / Bakery Name</Label>
            <Input value={b.appName ?? ""} onChange={(e) => setB({ ...b, appName: e.target.value })} placeholder="Marbith Bakery" className="mt-1 font-semibold" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tagline (shown below name in sidebar)</Label>
            <Input value={b.tagline ?? ""} onChange={(e) => setB({ ...b, tagline: e.target.value })} placeholder="& Investments" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Font Family</Label>
            <Select
              value={b.font || FONT_DEFAULT_SENTINEL}
              onValueChange={(v) => setB({ ...b, font: v === FONT_DEFAULT_SENTINEL ? "" : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem
                    key={f.value}
                    value={f.value}
                    style={{ fontFamily: f.value === FONT_DEFAULT_SENTINEL ? undefined : f.value }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border p-4 bg-sidebar" style={{ fontFamily: b.font || undefined }}>
            <p className="text-xs text-muted-foreground mb-2 font-sans">Preview</p>
            <div className="text-sidebar-primary font-bold text-lg leading-tight">{b.appName || "Marbith Bakery"}</div>
            <div className="text-xs text-sidebar-foreground/50">{b.tagline ?? "& Investments"}</div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">Staff Name · Role</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Save & Apply</Button>
            <Button variant="outline" onClick={reset}>Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700",
  staff:   "bg-blue-100 text-blue-700",
  cashier: "bg-yellow-100 text-yellow-700",
  baker:   "bg-orange-100 text-orange-700",
  rider:   "bg-green-100 text-green-700",
};

function PasswordsPanel() {
  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["dev-users-passwords"],
    queryFn: () => apiFetch("/dev/users-passwords"),
  });
  const [visible, setVisible] = useState<Record<number, boolean>>({});

  if (isLoading) return <div className="h-48 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <KeyRound className="h-4 w-4 shrink-0" />
        This view shows all login credentials. Only visible to users with this permission.
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Login</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Role</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Password</th>
                <th className="py-2.5 px-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u: any) => (
                <tr key={u.id} className={`border-t hover:bg-muted/20 ${!u.isActive ? "opacity-50" : ""}`}>
                  <td className="py-2.5 px-4 font-medium">
                    {u.name}
                    {!u.isActive && <span className="ml-1.5 text-xs text-muted-foreground italic">(inactive)</span>}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{u.username}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? "bg-muted"}`}>{u.role}</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-sm">
                    {visible[u.id] ? (
                      <span className="bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 text-yellow-900">{u.password}</span>
                    ) : (
                      <span className="tracking-widest text-muted-foreground">••••••••</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => setVisible((v) => ({ ...v, [u.id]: !v[u.id] }))}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={visible[u.id] ? "Hide" : "Reveal"}
                    >
                      {visible[u.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

const AVAILABLE_PERMS = [
  { key: "manage_shops",   label: "Manage Shops",    desc: "Can add shops, toggle them active/inactive, and assign staff to branches" },
  { key: "view_passwords", label: "View Passwords",  desc: "Can see all user login credentials in the Passwords tab" },
];

function PermissionsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: admins, isLoading } = useQuery<any[]>({
    queryKey: ["dev-admin-users"],
    queryFn: () => apiFetch("/dev/admin-users"),
  });

  const togglePerm = useMutation({
    mutationFn: ({ id, permission, grant }: { id: number; permission: string; grant: boolean }) =>
      apiFetch(`/dev/admin-users/${id}/permissions`, { method: "PATCH", body: JSON.stringify({ permission, grant }) }),
    onSuccess: (updated: any) => {
      qc.setQueryData(["dev-admin-users"], (old: any[] | undefined) =>
        (old ?? []).map((a) => (a.id === updated.id ? updated : a))
      );
      toast({ title: "Permission updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Grant or revoke developer-level privileges for other admin accounts. Only you can see and change these.
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (admins ?? []).length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No other admin accounts found.</div>
      ) : (
        (admins ?? []).map((admin) => (
          <Card key={admin.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-sm shrink-0">
                  {(admin.name as string)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{admin.name}</p>
                  <p className="text-xs text-muted-foreground">{admin.username}</p>
                </div>
              </div>
              <div className="space-y-3">
                {AVAILABLE_PERMS.map((perm) => {
                  const hasIt = (admin.extra_permissions ?? []).includes(perm.key);
                  return (
                    <div key={perm.key} className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.desc}</p>
                      </div>
                      <button
                        onClick={() => togglePerm.mutate({ id: admin.id, permission: perm.key, grant: !hasIt })}
                        disabled={togglePerm.isPending}
                        className={`shrink-0 transition-colors disabled:opacity-50 ${hasIt ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
                        title={hasIt ? `Revoke ${perm.label}` : `Grant ${perm.label}`}
                      >
                        {hasIt
                          ? <ToggleRight className="h-7 w-7" />
                          : <ToggleLeft className="h-7 w-7" />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

type Conversation = { id: number; title: string; createdAt: string };
type ChatMessage  = { id: number; conversationId: number; role: string; content: string; createdAt: string };

function AIChatPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: convos = [], isLoading: convosLoading } = useQuery<Conversation[]>({
    queryKey: ["ai-conversations"],
    queryFn: () => apiFetch("/anthropic/conversations"),
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<ChatMessage[]>({
    queryKey: ["ai-messages", activeConvId],
    queryFn: () => apiFetch(`/anthropic/conversations/${activeConvId}/messages`),
    enabled: activeConvId !== null,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const createConv = useMutation({
    mutationFn: (title: string) => apiFetch("/anthropic/conversations", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: (c: Conversation) => {
      qc.setQueryData<Conversation[]>(["ai-conversations"], (old = []) => [...old, c]);
      setActiveConvId(c.id);
      setNewTitle("");
      setShowNewConv(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteConv = useMutation({
    mutationFn: (id: number) => apiFetch(`/anthropic/conversations/${id}`, { method: "DELETE" }),
    onSuccess: (_: any, id: number) => {
      qc.setQueryData<Conversation[]>(["ai-conversations"], (old = []) => old.filter((c) => c.id !== id));
      if (activeConvId === id) { setActiveConvId(null); }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function sendMessage() {
    if (!input.trim() || !activeConvId || streaming) return;
    const msg = input.trim();
    setInput("");
    setStreaming(true);
    setStreamingText("");

    const token = getToken();
    const optimisticUser: ChatMessage = {
      id: Date.now(), conversationId: activeConvId,
      role: "user", content: msg, createdAt: new Date().toISOString(),
    };
    qc.setQueryData<ChatMessage[]>(["ai-messages", activeConvId], (old = []) => [...old, optimisticUser]);

    try {
      const res = await fetch(`${API_BASE}/api/anthropic/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: msg }),
      });

      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.content) { full += data.content; setStreamingText(full); }
            if (data.done) {
              const assistantMsg: ChatMessage = {
                id: Date.now() + 1, conversationId: activeConvId,
                role: "assistant", content: full, createdAt: new Date().toISOString(),
              };
              qc.setQueryData<ChatMessage[]>(["ai-messages", activeConvId], (old = []) => [...old, assistantMsg]);
              setStreamingText("");
            }
          } catch (parseErr: any) {
            if (parseErr.message !== "Unexpected end of JSON input") throw parseErr;
          }
        }
      }
    } catch (err: any) {
      toast({ title: "AI error", description: err.message, variant: "destructive" });
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const activeConv = convos.find((c) => c.id === activeConvId);

  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ["ai-status"],
    queryFn: () => apiFetch("/anthropic/status"),
    retry: false,
  });

  if (aiStatus && !aiStatus.available) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Bot className="h-12 w-12 text-gray-300" />
        <h3 className="font-semibold text-gray-600 text-lg">AI Assistant Not Configured</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          The AI assistant requires an Anthropic API key. On Render, set the{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">ANTHROPIC_API_KEY</code> environment variable to enable it.
        </p>
        <p className="text-xs text-gray-400">All other features work normally.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
        <Bot className="h-4 w-4 shrink-0" />
        AI assistant powered by Claude — has full context of today's work, DB stats, and system architecture. Only visible to you.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 min-h-[480px]">
        {/* Conversation list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversations</span>
            <button
              onClick={() => setShowNewConv(true)}
              className="text-primary hover:text-primary/80 transition-colors"
              title="New conversation"
            >
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>

          {showNewConv && (
            <div className="flex gap-1.5">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Topic…"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim()) createConv.mutate(newTitle.trim());
                  if (e.key === "Escape") { setShowNewConv(false); setNewTitle(""); }
                }}
                autoFocus
              />
              <button
                onClick={() => newTitle.trim() && createConv.mutate(newTitle.trim())}
                disabled={createConv.isPending || !newTitle.trim()}
                className="shrink-0 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                {createConv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {convosLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}
            </div>
          ) : convos.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-30" />
              No conversations yet.<br />Click + to start one.
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto max-h-[420px]">
              {convos.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer text-sm transition-colors ${
                    activeConvId === c.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/60 text-foreground"
                  }`}
                  onClick={() => setActiveConvId(c.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate text-xs">{c.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConv.mutate(c.id); }}
                    className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      activeConvId === c.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"
                    }`}
                    title="Delete conversation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <Card className="flex flex-col min-h-[480px]">
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Bot className="h-7 w-7 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Marbith AI Assistant</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Ask me about today's changes, errors in the system, DB stats, or anything about the codebase.
                  I have full context of the entire app.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowNewConv(true)} className="gap-1.5 mt-1">
                <PlusCircle className="h-3.5 w-3.5" /> New Conversation
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Bot className="h-4 w-4 text-purple-600 shrink-0" />
                <span className="font-semibold text-sm truncate flex-1">{activeConv?.title ?? "Chat"}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {msgsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
                  </div>
                ) : messages.length === 0 && !streaming ? (
                  <div className="text-center text-xs text-muted-foreground py-10">
                    Send a message to start the conversation.
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "assistant" && (
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                            <Bot className="h-4 w-4 text-purple-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                            m.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {streaming && (
                      <div className="flex justify-start">
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                          <Bot className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-muted text-foreground whitespace-pre-wrap leading-relaxed">
                          {streamingText || <span className="flex gap-1 items-center"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</span>}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about the system… (Enter to send, Shift+Enter for newline)"
                    className="resize-none text-sm min-h-[44px] max-h-[160px]"
                    rows={2}
                    disabled={streaming}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!input.trim() || streaming}
                    className="shrink-0 h-10 w-10"
                  >
                    {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
