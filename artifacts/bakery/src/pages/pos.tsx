import { useState } from "react";
import { useListProducts, useCreateSale, useGetSale, getListSalesQueryKey, getGetDailySalesSummaryQueryKey, getGetDashboardSummaryQueryKey, getListInventoryQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer } from "lucide-react";

interface CartItem { productId: number; name: string; price: number; quantity: number; }

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "airtel_money", label: "Airtel Money" },
];

export default function POSPage() {
  const { data: products } = useListProducts();
  const createSale = useCreateSale();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const { data: receiptData } = useGetSale(receiptSaleId ?? 0, { query: { enabled: !!receiptSaleId } });

  const activeProducts = products?.filter((p) => p.isActive && p.currentStock > 0) ?? [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addToCart(product: typeof activeProducts[0]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? null : { ...i, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    const needsTxId = paymentMethod !== "cash";
    if (needsTxId && !transactionId) {
      toast({ title: "Transaction ID required", description: "Please enter the mobile money transaction ID", variant: "destructive" });
      return;
    }
    try {
      const sale = await createSale.mutateAsync({
        data: {
          paymentMethod: paymentMethod as "cash" | "mtn_momo" | "airtel_money",
          transactionId: needsTxId ? transactionId : undefined,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      });
      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setReceiptSaleId(sale.id);
      setShowReceipt(true);
      setCart([]);
      setTransactionId("");
    } catch {
      toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">POS — Sales Terminal</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Product grid */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Products</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {activeProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-primary font-bold text-sm mt-0.5">{formatUGX(p.price)}</div>
                  <div className="text-xs text-muted-foreground">{p.currentStock} left</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Cart {cart.length > 0 && `(${cart.length} items)`}</CardTitle></CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tap products to add them</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatUGX(item.price)} each</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, -1)} className="p-1 rounded hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, 1)} className="p-1 rounded hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="text-sm font-bold text-right w-20">{formatUGX(item.price * item.quantity)}</div>
                    <button onClick={() => removeFromCart(item.productId)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border space-y-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatUGX(total)}</span>
                </div>
                <div>
                  <Label className="text-sm">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod !== "cash" && (
                  <div>
                    <Label className="text-sm">Transaction ID</Label>
                    <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Mobile money transaction ID" className="mt-1" />
                  </div>
                )}
                <Button className="w-full" onClick={handleCheckout} disabled={createSale.isPending}>
                  {createSale.isPending ? "Processing..." : "Complete Sale"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-4 w-4" />Receipt</DialogTitle></DialogHeader>
          {receiptData && (
            <div className="space-y-4">
              <div className="text-center border-b border-border pb-3">
                <div className="font-bold text-lg">Kampala Bakes</div>
                <div className="text-xs text-muted-foreground">Receipt #{receiptData.receiptNumber}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(receiptData.soldAt)}</div>
              </div>
              <div className="space-y-1">
                {receiptData.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.productName} x{item.quantity}</span>
                    <span>{formatUGX(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatUGX(receiptData.totalAmount)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Payment: {receiptData.paymentMethod.replace(/_/g, " ").toUpperCase()}
                {receiptData.transactionId && ` | TX: ${receiptData.transactionId}`}
              </div>
              <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                Thank you for your purchase!
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
