import { useState } from "react";
import { useListProducts, useCreateOrder } from "@workspace/api-client-react";
import { formatUGX } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Trash2, CheckCircle } from "lucide-react";

interface CartItem { productId: number; name: string; price: number; quantity: number; }

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash on Delivery" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "airtel_money", label: "Airtel Money" },
];

export default function OrderFormPage() {
  const { data: products } = useListProducts();
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", deliveryLocation: "", paymentMethod: "cash", transactionId: "" });
  const [orderId, setOrderId] = useState<number | null>(null);

  const activeProducts = products?.filter((p) => p.isActive) ?? [];
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function addToCart(p: typeof activeProducts[0]) {
    setCart((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    try {
      const order = await createOrder.mutateAsync({
        data: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryLocation: form.deliveryLocation,
          paymentMethod: form.paymentMethod as "cash" | "mtn_momo" | "airtel_money",
          transactionId: form.transactionId || undefined,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      });
      setOrderId(order!.id);
    } catch {
      toast({ title: "Error", description: "Failed to place order. Please try again.", variant: "destructive" });
    }
  }

  if (orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Placed!</h2>
            <p className="text-muted-foreground text-sm mb-1">Your order #{orderId} has been received.</p>
            <p className="text-muted-foreground text-sm">We will contact you at {form.customerPhone} to confirm.</p>
            <div className="mt-6 p-4 bg-muted rounded-lg text-left space-y-1">
              <div className="text-sm"><strong>Name:</strong> {form.customerName}</div>
              <div className="text-sm"><strong>Location:</strong> {form.deliveryLocation}</div>
              <div className="text-sm"><strong>Total:</strong> {formatUGX(total)}</div>
              <div className="text-sm"><strong>Payment:</strong> {PAYMENT_METHODS.find((m) => m.value === form.paymentMethod)?.label}</div>
            </div>
            <Button className="w-full mt-6" onClick={() => { setOrderId(null); setCart([]); setForm({ customerName: "", customerPhone: "", deliveryLocation: "", paymentMethod: "cash", transactionId: "" }); }}>
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-sidebar text-sidebar-foreground px-4 py-5 text-center">
        <h1 className="text-2xl font-bold text-sidebar-primary">Marbith Bakery & Investments</h1>
        <p className="text-sidebar-foreground/60 text-sm mt-0.5">Order fresh baked goods — delivered to you</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Product selection */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Choose Your Items</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {activeProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-primary font-bold text-sm">{formatUGX(p.price)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        {cart.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your Order</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2">
                    <div className="flex-1 text-sm font-medium">{item.name}</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCart((p) => p.map((i) => i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="p-1 rounded hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => setCart((p) => p.map((i) => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))} className="p-1 rounded hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="text-sm font-bold w-20 text-right">{formatUGX(item.price * item.quantity)}</div>
                    <button onClick={() => setCart((p) => p.filter((i) => i.productId !== item.productId))} className="p-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatUGX(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer form */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Your Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Your Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Full name" className="mt-1" required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="07xx xxx xxx" className="mt-1" required />
              </div>
              <div>
                <Label>Delivery Location</Label>
                <Input value={form.deliveryLocation} onChange={(e) => setForm({ ...form, deliveryLocation: e.target.value })} placeholder="Area, street, landmark..." className="mt-1" required />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.paymentMethod !== "cash" && (
                <div>
                  <Label>Mobile Money Transaction ID (optional)</Label>
                  <Input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="Transaction ID" className="mt-1" />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={createOrder.isPending || cart.length === 0}>
                {createOrder.isPending ? "Placing Order..." : `Place Order — ${formatUGX(total)}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
