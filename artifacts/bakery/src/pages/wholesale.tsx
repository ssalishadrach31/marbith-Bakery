import { useState } from "react";
import { useListWholesaleCustomers, useCreateWholesaleCustomer, useListWholesaleSupplies, useCreateWholesaleSupply, useUpdateSupplyPaymentStatus, useGetWholesaleOutstandingBalance, useListProducts, getListWholesaleCustomersQueryKey, getListWholesaleSuppliesQueryKey, getGetWholesaleOutstandingBalanceQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  unpaid: "bg-red-100 text-red-700",
  credit: "bg-yellow-100 text-yellow-700",
};

interface CartItem { productId: number; name: string; price: number; quantity: number; }

export default function WholesalePage() {
  const { data: customers } = useListWholesaleCustomers({ query: { queryKey: getListWholesaleCustomersQueryKey() } });
  const { data: supplies } = useListWholesaleSupplies({ query: { queryKey: getListWholesaleSuppliesQueryKey() } });
  const { data: balance } = useGetWholesaleOutstandingBalance({ query: { queryKey: getGetWholesaleOutstandingBalanceQueryKey() } });
  const { data: products } = useListProducts();
  const createCustomer = useCreateWholesaleCustomer();
  const createSupply = useCreateWholesaleSupply();
  const updatePayment = useUpdateSupplyPaymentStatus();
  const { toast } = useToast();

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ id: number; total: number } | null>(null);

  const [custForm, setCustForm] = useState({ name: "", contactPerson: "", phone: "", location: "" });
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [supplyCart, setSupplyCart] = useState<CartItem[]>([]);
  const [supplyPayment, setSupplyPayment] = useState("paid");
  const [amountPaid, setAmountPaid] = useState("");
  const [payStatus, setPayStatus] = useState("paid");
  const [payAmount, setPayAmount] = useState("");

  const activeProducts = products?.filter((p) => p.isActive) ?? [];

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCustomer.mutateAsync({ data: custForm });
      queryClient.invalidateQueries({ queryKey: getListWholesaleCustomersQueryKey() });
      setCustForm({ name: "", contactPerson: "", phone: "", location: "" });
      setShowCustomerForm(false);
      toast({ title: "Customer added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  function addProduct(p: typeof activeProducts[0]) {
    setSupplyCart((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }

  async function handleCreateSupply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer || supplyCart.length === 0) return;
    try {
      await createSupply.mutateAsync({
        data: {
          customerId: parseInt(selectedCustomer),
          items: supplyCart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          paymentStatus: supplyPayment as "paid" | "unpaid" | "credit",
          amountPaid: parseFloat(amountPaid) || 0,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListWholesaleSuppliesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListWholesaleCustomersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWholesaleOutstandingBalanceQueryKey() });
      setShowSupplyForm(false); setSupplyCart([]); setSelectedCustomer(""); setAmountPaid("");
      toast({ title: "Supply recorded" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function handlePaymentUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentModal) return;
    try {
      await updatePayment.mutateAsync({ id: paymentModal.id, data: { paymentStatus: payStatus as any, amountPaid: parseFloat(payAmount) } });
      queryClient.invalidateQueries({ queryKey: getListWholesaleSuppliesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListWholesaleCustomersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWholesaleOutstandingBalanceQueryKey() });
      setPaymentModal(null);
      toast({ title: "Payment updated" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Wholesale / Supply</h1>
          {balance && <p className="text-sm text-amber-600 mt-0.5">Outstanding: {formatUGX(balance.totalOutstanding)} from {balance.customerCount} customers</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCustomerForm(true)}>Add Customer</Button>
          <Button size="sm" onClick={() => setShowSupplyForm(true)}>Record Supply</Button>
        </div>
      </div>

      <Tabs defaultValue="supplies">
        <TabsList>
          <TabsTrigger value="supplies">Supplies</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="supplies" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Paid</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplies?.slice().reverse().map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium">{s.customerName}</td>
                        <td className="py-3 px-4 font-bold text-primary">{formatUGX(s.totalAmount)}</td>
                        <td className="py-3 px-4">{formatUGX(s.amountPaid)}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[s.paymentStatus]}`}>{s.paymentStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{formatDateTime(s.suppliedAt)}</td>
                        <td className="py-3 px-4 text-right">
                          {s.paymentStatus !== "paid" && (
                            <Button size="sm" variant="outline" onClick={() => { setPaymentModal({ id: s.id, total: s.totalAmount }); setPayStatus(s.paymentStatus); setPayAmount(String(s.amountPaid)); }}>
                              Update Pay
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!supplies || supplies.length === 0) && <p className="text-sm text-muted-foreground text-center py-10">No supply records yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers?.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium">{c.name}</td>
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                          <div>{c.contactPerson}</div>
                          <div className="text-xs">{c.phone}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{c.location}</td>
                        <td className="py-3 px-4">
                          <span className={c.totalOutstanding > 0 ? "text-amber-600 font-bold" : "text-muted-foreground"}>
                            {formatUGX(c.totalOutstanding)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!customers || customers.length === 0) && <p className="text-sm text-muted-foreground text-center py-10">No customers yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Customer */}
      <Dialog open={showCustomerForm} onOpenChange={setShowCustomerForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Business Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-3">
            {(["name", "contactPerson", "phone", "location"] as const).map((field) => (
              <div key={field}>
                <Label>{field === "contactPerson" ? "Contact Person" : field.charAt(0).toUpperCase() + field.slice(1)}</Label>
                <Input value={custForm[field]} onChange={(e) => setCustForm({ ...custForm, [field]: e.target.value })} className="mt-1" required />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCustomerForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createCustomer.isPending}>Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Supply */}
      <Dialog open={showSupplyForm} onOpenChange={setShowSupplyForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Supply</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSupply} className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Products</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {activeProducts.map((p) => (
                  <button type="button" key={p.id} onClick={() => addProduct(p)} className="text-left p-2 rounded border border-border hover:border-primary text-xs">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-primary">{formatUGX(p.price)}</div>
                  </button>
                ))}
              </div>
              {supplyCart.length > 0 && (
                <div className="mt-2 space-y-1">
                  {supplyCart.map((i) => (
                    <div key={i.productId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{i.name} x{i.quantity}</span>
                      <span>{formatUGX(i.price * i.quantity)}</span>
                      <button type="button" onClick={() => setSupplyCart((prev) => prev.filter((p) => p.productId !== i.productId))}><Trash2 className="h-3 w-3 text-destructive" /></button>
                    </div>
                  ))}
                  <div className="font-bold text-sm text-right">Total: {formatUGX(supplyCart.reduce((s, i) => s + i.price * i.quantity, 0))}</div>
                </div>
              )}
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={supplyPayment} onValueChange={setSupplyPayment}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["paid", "unpaid", "credit"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount Paid (UGX)</Label>
              <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowSupplyForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createSupply.isPending || !selectedCustomer || supplyCart.length === 0}>Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment update */}
      <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Payment</DialogTitle></DialogHeader>
          <form onSubmit={handlePaymentUpdate} className="space-y-4">
            <p className="text-sm text-muted-foreground">Total: {formatUGX(paymentModal?.total ?? 0)}</p>
            <div>
              <Label>Payment Status</Label>
              <Select value={payStatus} onValueChange={setPayStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["paid", "unpaid", "credit"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount Paid (UGX)</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setPaymentModal(null)}>Cancel</Button>
              <Button type="submit" disabled={updatePayment.isPending}>Update</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
