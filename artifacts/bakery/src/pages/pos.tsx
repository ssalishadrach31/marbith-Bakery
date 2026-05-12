import { useState, useRef, useEffect, useCallback } from "react";
import { useListProducts, useCreateSale, useGetSale, getListSalesQueryKey, getGetDailySalesSummaryQueryKey, getGetDashboardSummaryQueryKey, getListInventoryQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, Download, PenLine, RotateCcw, Check } from "lucide-react";

interface CartItem { productId: number; name: string; price: number; quantity: number; }

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "airtel_money", label: "Airtel Money" },
];

const SIG_KEY = "marbith_admin_signature";

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw() { drawing.current = false; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Draw your signature below. It will appear at the bottom of all printed receipts.</p>
      <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={480}
          height={140}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </Button>
        <Button size="sm" onClick={save} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> Save Signature
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function POSPage() {
  const { data: products } = useListProducts();
  const createSale = useCreateSale();
  const { toast } = useToast();
  const user = getUser();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [savedSig, setSavedSig] = useState<string | null>(() => localStorage.getItem(SIG_KEY));

  const { data: receiptData } = useGetSale(receiptSaleId ?? 0, { query: { enabled: !!receiptSaleId, queryKey: ["sale", receiptSaleId] } });

  const activeProducts = products?.filter((p) => p.isActive && p.currentStock > 0) ?? [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isAdmin = user?.role === "admin";

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

  function saveSig(dataUrl: string) {
    localStorage.setItem(SIG_KEY, dataUrl);
    setSavedSig(dataUrl);
    setShowSigPad(false);
    toast({ title: "Signature saved", description: "Your signature will appear on printed receipts" });
  }

  function clearSig() {
    localStorage.removeItem(SIG_KEY);
    setSavedSig(null);
    toast({ title: "Signature cleared" });
  }

  function downloadReceipt() {
    if (!receiptData) return;
    const sig = localStorage.getItem(SIG_KEY);
    const sigHtml = sig
      ? `<div style="margin-top:24px;border-top:1px solid #ddd;padding-top:16px;">
           <div style="font-size:11px;color:#666;margin-bottom:6px;">Authorised by:</div>
           <img src="${sig}" style="max-width:180px;max-height:70px;" alt="Signature"/>
         </div>`
      : "";

    const itemsHtml = receiptData.items.map((item) =>
      `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
         <span>${item.productName} x${item.quantity}</span>
         <span>${formatUGX(item.subtotal)}</span>
       </div>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Receipt #${receiptData.receiptNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 8mm; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; }
    .total { font-weight: bold; font-size: 15px; }
    .muted { color: #666; font-size: 11px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="center">
    <div style="font-weight:bold;font-size:16px;">Marbith Bakery &amp; Investments</div>
    <div class="muted">Kampala, Uganda</div>
    <div class="muted" style="margin-top:4px;">Receipt #${receiptData.receiptNumber}</div>
    <div class="muted">${formatDateTime(receiptData.soldAt)}</div>
  </div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="row total"><span>TOTAL</span><span>${formatUGX(receiptData.totalAmount)}</span></div>
  <div class="muted" style="margin-top:8px;">Payment: ${receiptData.paymentMethod.replace(/_/g, " ").toUpperCase()}${receiptData.transactionId ? ` | TX: ${receiptData.transactionId}` : ""}</div>
  <div class="muted" style="margin-top:4px;">Served by: ${receiptData.soldBy ?? "—"}</div>
  ${sigHtml}
  <div class="divider"></div>
  <div class="center muted">Thank you for your purchase!</div>
  <script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) { toast({ title: "Pop-up blocked", description: "Please allow pop-ups for this site", variant: "destructive" }); return; }
    win.document.write(html);
    win.document.close();
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

      {/* Signature management (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Admin Signature for Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showSigPad ? (
              <SignaturePad onSave={saveSig} onCancel={() => setShowSigPad(false)} />
            ) : savedSig ? (
              <div className="flex items-center gap-4">
                <div className="border rounded-lg bg-white p-2 flex-shrink-0">
                  <img src={savedSig} alt="Admin signature" className="max-h-14 max-w-[160px]" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">This signature will appear on all printed receipts.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSigPad(true)} className="gap-1.5">
                      <PenLine className="h-3.5 w-3.5" /> Re-draw
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSig} className="text-destructive hover:text-destructive">Remove</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground flex-1">No signature set. Add one to appear on printed receipts.</p>
                <Button variant="outline" size="sm" onClick={() => setShowSigPad(true)} className="gap-1.5 shrink-0">
                  <PenLine className="h-3.5 w-3.5" /> Draw Signature
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => { setShowReceipt(open); if (!open) setShowSigPad(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div className="space-y-4">
              <div className="text-center border-b border-border pb-3">
                <div className="font-bold text-lg">Marbith Bakery &amp; Investments</div>
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

              {/* Signature preview on receipt */}
              {savedSig && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-1">Authorised by:</div>
                  <img src={savedSig} alt="Signature" className="max-h-12 max-w-[140px]" />
                </div>
              )}

              <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                Thank you for your purchase!
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 gap-2" onClick={downloadReceipt}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowReceipt(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
