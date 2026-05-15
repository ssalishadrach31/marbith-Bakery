import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, useCreateSale, useGetSale, getListSalesQueryKey, getGetDailySalesSummaryQueryKey, getGetDashboardSummaryQueryKey, getListInventoryQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatUGX, formatDateTime, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, Download, PenLine, RotateCcw, Check, Phone, Settings2, Stamp } from "lucide-react";

interface CartItem { productId: number; name: string; price: number; quantity: number; stock: number; }

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "airtel_money", label: "Airtel Money" },
];

const SIG_KEY = "marbith_admin_signature";
const MTN_KEY = "marbith_mtn_number";
const AIRTEL_KEY = "marbith_airtel_number";
const STAMP_KEY = "marbith_receipt_stamp";

type StampColor = "red" | "blue" | "green" | "purple";

interface StampConfig {
  enabled: boolean;
  text: string;
  color: StampColor;
}

const STAMP_COLORS: { value: StampColor; label: string; hex: string }[] = [
  { value: "red", label: "Red", hex: "#cc0000" },
  { value: "blue", label: "Blue", hex: "#0055aa" },
  { value: "green", label: "Green", hex: "#006600" },
  { value: "purple", label: "Purple", hex: "#660099" },
];

const DEFAULT_STAMP: StampConfig = { enabled: true, text: "MARBITH BAKERY & INVESTMENTS", color: "red" };

function loadStamp(): StampConfig {
  try {
    const raw = localStorage.getItem(STAMP_KEY);
    return raw ? { ...DEFAULT_STAMP, ...JSON.parse(raw) } : DEFAULT_STAMP;
  } catch { return DEFAULT_STAMP; }
}

function getStampColorHex(color: StampColor): string {
  return STAMP_COLORS.find((c) => c.value === color)?.hex ?? "#cc0000";
}

function StampPreview({ config, size = 110 }: { config: StampConfig; size?: number }) {
  const colorHex = getStampColorHex(config.color);
  const borderW = Math.round(size * 0.035);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `${borderW}px solid ${colorHex}`,
        boxShadow: `inset 0 0 0 ${Math.round(size * 0.02)}px ${colorHex}44`,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", opacity: 0.88, position: "relative",
        overflow: "hidden", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%) rotate(-18deg)",
        color: colorHex, fontWeight: "bold",
        fontSize: Math.round(size * 0.22),
        fontFamily: "Georgia, serif", letterSpacing: 1, whiteSpace: "nowrap",
      }}>PAID</div>
      <div style={{
        position: "absolute", top: Math.round(size * 0.1), left: 0, right: 0,
        textAlign: "center", color: colorHex,
        fontSize: Math.round(size * 0.07),
        fontFamily: "Georgia, serif", letterSpacing: 0.8,
        padding: `0 ${Math.round(size * 0.18)}px`, lineHeight: 1.2, wordBreak: "break-word",
      }}>{config.text.toUpperCase()}</div>
      <div style={{
        position: "absolute", bottom: Math.round(size * 0.12), left: 0, right: 0,
        textAlign: "center", color: colorHex,
        fontSize: Math.round(size * 0.07), fontFamily: "Georgia, serif",
      }}>{new Date().toLocaleDateString("en-GB")}</div>
    </div>
  );
}

function makeStampHtml(config: StampConfig, date: string): string {
  const colorHex = getStampColorHex(config.color);
  const text = config.text.toUpperCase();
  return `<div style="display:flex;justify-content:center;margin:20px 0;">
  <div style="width:130px;height:130px;border-radius:50%;border:5px solid ${colorHex};box-shadow:inset 0 0 0 3px ${colorHex}44;position:relative;opacity:0.88;flex-shrink:0;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);color:${colorHex};font-weight:bold;font-size:28px;font-family:Georgia,serif;letter-spacing:1px;white-space:nowrap;">PAID</div>
    <div style="position:absolute;top:14px;left:0;right:0;text-align:center;color:${colorHex};font-size:8.5px;font-family:Georgia,serif;letter-spacing:0.8px;padding:0 20px;line-height:1.25;word-break:break-word;">${text}</div>
    <div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;color:${colorHex};font-size:9px;font-family:Georgia,serif;">${date}</div>
  </div>
</div>`;
}

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault(); drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2.5;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
  }

  function endDraw() { drawing.current = false; }

  function clearCanvas() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current; if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Draw your signature below. It will appear at the bottom of all printed receipts.</p>
      <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef} width={480} height={140}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>
        <Button size="sm" onClick={save} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Save Signature</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function POSPage() {
  const qc = useQueryClient();
  const { data: products } = useListProducts({ query: { queryKey: getListProductsQueryKey(), refetchInterval: 30_000 } });
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
  const [mtnNumber, setMtnNumber] = useState(() => localStorage.getItem(MTN_KEY) ?? "");
  const [airtelNumber, setAirtelNumber] = useState(() => localStorage.getItem(AIRTEL_KEY) ?? "");
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [draftMtn, setDraftMtn] = useState("");
  const [draftAirtel, setDraftAirtel] = useState("");

  const [stamp, setStamp] = useState<StampConfig>(() => loadStamp());
  const [editingStamp, setEditingStamp] = useState(false);
  const [draftStamp, setDraftStamp] = useState<StampConfig>(DEFAULT_STAMP);

  const { data: receiptData } = useGetSale(receiptSaleId ?? 0, { query: { enabled: !!receiptSaleId, queryKey: ["sale", receiptSaleId] } });

  const activeProducts = products?.filter((p) => p.isActive && p.currentStock > 0) ?? [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isAdmin = user?.role === "admin";

  function addToCart(product: typeof activeProducts[0]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) return prev;
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, stock: product.currentStock }];
    });
  }

  function removeFromCart(productId: number) { setCart((prev) => prev.filter((i) => i.productId !== productId)); }

  function updateQty(productId: number, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > i.stock) return i;
      return { ...i, quantity: newQty };
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
      qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setReceiptSaleId(sale.id);
      setShowReceipt(true);
      setCart([]);
      setTransactionId("");
    } catch (err: any) {
      if (err?.status === 409 || err?.data?.code === "INSUFFICIENT_STOCK") {
        const name = err?.data?.productName ?? "an item";
        const avail = err?.data?.available ?? 0;
        const req = err?.data?.requested ?? 0;
        toast({
          title: "Not enough stock",
          description: `Only ${avail} unit${avail !== 1 ? "s" : ""} of "${name}" available — you requested ${req}. Please update your cart.`,
          variant: "destructive",
        });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      } else {
        toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
      }
    }
  }

  function saveNumbers() {
    localStorage.setItem(MTN_KEY, draftMtn); localStorage.setItem(AIRTEL_KEY, draftAirtel);
    setMtnNumber(draftMtn); setAirtelNumber(draftAirtel); setEditingNumbers(false);
    toast({ title: "Numbers saved", description: "Mobile money numbers updated for dialer prompts" });
  }

  function openDialer() {
    const num = paymentMethod === "mtn_momo" ? mtnNumber : airtelNumber;
    if (!num || total === 0) return;
    const ussd = paymentMethod === "mtn_momo" ? `tel:*165*3*${num}*${total}%23` : `tel:*185*1*${num}*${total}%23`;
    window.location.href = ussd;
  }

  function saveSig(dataUrl: string) {
    localStorage.setItem(SIG_KEY, dataUrl); setSavedSig(dataUrl); setShowSigPad(false);
    toast({ title: "Signature saved", description: "Your signature will appear on printed receipts" });
  }

  function clearSig() { localStorage.removeItem(SIG_KEY); setSavedSig(null); toast({ title: "Signature cleared" }); }

  function openStampEdit() { setDraftStamp({ ...stamp }); setEditingStamp(true); }

  function saveStamp() {
    localStorage.setItem(STAMP_KEY, JSON.stringify(draftStamp));
    setStamp({ ...draftStamp }); setEditingStamp(false);
    toast({
      title: draftStamp.enabled ? "Stamp saved" : "Stamp disabled",
      description: draftStamp.enabled ? "The receipt stamp has been updated" : "No stamp will appear on receipts",
    });
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

    const stampCfg = loadStamp();
    const receiptDate = new Date(receiptData.soldAt).toLocaleDateString("en-GB");
    const stampHtml = stampCfg.enabled ? makeStampHtml(stampCfg, receiptDate) : "";

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
  ${stampHtml}
  <div class="divider"></div>
  <div class="center muted">Thank you for your purchase!</div>
  <script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=380,height=650");
    if (!win) { toast({ title: "Pop-up blocked", description: "Please allow pop-ups for this site", variant: "destructive" }); return; }
    win.document.write(html); win.document.close();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">POS — Sales Terminal</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Product grid */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Products</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 h-[55vh] overflow-y-auto overscroll-contain pr-1">
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
              <div className="space-y-2 max-h-52 overflow-y-auto overscroll-contain pr-1">
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
                {paymentMethod !== "cash" && (() => {
                  const isMtn = paymentMethod === "mtn_momo";
                  const num = isMtn ? mtnNumber : airtelNumber;
                  const hasNum = !!num;
                  return (
                    <>
                      <div className={`rounded-xl border-2 p-4 space-y-3 ${isMtn ? "border-yellow-300 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
                        <div className={`flex items-center gap-2 font-semibold text-sm ${isMtn ? "text-yellow-800" : "text-red-800"}`}>
                          <Phone className="h-4 w-4" />
                          {isMtn ? "MTN Mobile Money" : "Airtel Money"} — Ask Customer to Dial
                        </div>
                        {hasNum ? (
                          <>
                            <div className={`rounded-lg p-3 font-mono text-sm font-bold text-center ${isMtn ? "bg-yellow-100 text-yellow-900" : "bg-red-100 text-red-900"}`}>
                              {isMtn ? `*165*3*${num}*${total}#` : `*185*1*${num}*${total}#`}
                            </div>
                            <p className={`text-xs ${isMtn ? "text-yellow-700" : "text-red-700"}`}>
                              Customer dials the code above → enters PIN → money is sent.
                            </p>
                            <button
                              type="button"
                              onClick={openDialer}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-colors ${isMtn ? "bg-yellow-400 hover:bg-yellow-500 text-yellow-900" : "bg-red-500 hover:bg-red-600 text-white"}`}
                            >
                              <Phone className="h-4 w-4" /> Open Dialer on This Device
                            </button>
                          </>
                        ) : (
                          <p className={`text-xs ${isMtn ? "text-yellow-700" : "text-red-700"}`}>
                            No {isMtn ? "MTN" : "Airtel"} number configured yet. {isAdmin ? "Set it in the Phone Numbers card below." : "Ask admin to set the mobile money number."}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm">Transaction ID (after payment)</Label>
                        <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Enter the MoMo transaction ID" className="mt-1" />
                      </div>
                    </>
                  );
                })()}
                <Button className="w-full" onClick={handleCheckout} disabled={createSale.isPending}>
                  {createSale.isPending ? "Processing..." : "Complete Sale"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile money number settings (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Mobile Money Numbers (Dialer)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingNumbers ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Enter the business mobile money numbers. These will be pre-filled in the USSD dialer when processing mobile payments.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-yellow-700 font-medium">MTN MoMo Number</Label>
                    <Input value={draftMtn} onChange={(e) => setDraftMtn(e.target.value)} placeholder="e.g. 0776123456" className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-red-700 font-medium">Airtel Money Number</Label>
                    <Input value={draftAirtel} onChange={(e) => setDraftAirtel(e.target.value)} placeholder="e.g. 0752123456" className="mt-1 font-mono" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNumbers} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Save Numbers</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNumbers(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex gap-4 flex-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    <span className="text-muted-foreground">MTN:</span>
                    <span className="font-mono font-semibold">{mtnNumber || <span className="text-muted-foreground italic">not set</span>}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <span className="text-muted-foreground">Airtel:</span>
                    <span className="font-mono font-semibold">{airtelNumber || <span className="text-muted-foreground italic">not set</span>}</span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setDraftMtn(mtnNumber); setDraftAirtel(airtelNumber); setEditingNumbers(true); }} className="gap-1.5 shrink-0">
                  <Settings2 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                    <Button variant="outline" size="sm" onClick={() => setShowSigPad(true)} className="gap-1.5"><PenLine className="h-3.5 w-3.5" /> Re-draw</Button>
                    <Button variant="ghost" size="sm" onClick={clearSig} className="text-destructive hover:text-destructive">Remove</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground flex-1">No signature set. Add one to appear on printed receipts.</p>
                <Button variant="outline" size="sm" onClick={() => setShowSigPad(true)} className="gap-1.5 shrink-0"><PenLine className="h-3.5 w-3.5" /> Draw Signature</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt stamp settings (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stamp className="h-4 w-4" />
              Receipt Stamp
              {stamp.enabled && <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">Active</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingStamp ? (
              <div className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="flex flex-col items-center gap-1.5">
                    <StampPreview config={draftStamp} size={110} />
                    <span className="text-xs text-muted-foreground">Preview</span>
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="stamp-enabled"
                        checked={draftStamp.enabled}
                        onChange={(e) => setDraftStamp((d) => ({ ...d, enabled: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      <Label htmlFor="stamp-enabled" className="cursor-pointer">Show stamp on receipts</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Stamp Text</Label>
                      <Input
                        value={draftStamp.text}
                        onChange={(e) => setDraftStamp((d) => ({ ...d, text: e.target.value }))}
                        placeholder="e.g. MARBITH BAKERY & INVESTMENTS"
                        className="mt-1"
                        maxLength={40}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Appears inside the stamp seal (max 40 characters)</p>
                    </div>
                    <div>
                      <Label className="text-xs">Stamp Colour</Label>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {STAMP_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setDraftStamp((d) => ({ ...d, color: c.value }))}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${draftStamp.color === c.value ? "border-foreground bg-muted" : "border-transparent hover:border-muted-foreground/40"}`}
                          >
                            <span className="w-6 h-6 rounded-full" style={{ backgroundColor: c.hex }} />
                            <span className="text-xs">{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveStamp} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Save Stamp</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingStamp(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {stamp.enabled ? (
                  <>
                    <StampPreview config={stamp} size={72} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{stamp.text}</p>
                      <p className="text-xs text-muted-foreground capitalize">Colour: {stamp.color} · Appears on all printed receipts</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground flex-1">Stamp is disabled. Enable it to add an official seal to receipts.</p>
                )}
                <Button variant="outline" size="sm" onClick={openStampEdit} className="gap-1.5 shrink-0">
                  <Stamp className="h-3.5 w-3.5" /> {stamp.enabled ? "Edit" : "Set Up"} Stamp
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
              <div className="max-h-44 overflow-y-auto space-y-1 rounded border border-border px-2 py-1">
                {receiptData.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
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

              {savedSig && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-1">Authorised by:</div>
                  <img src={savedSig} alt="Signature" className="max-h-12 max-w-[140px]" />
                </div>
              )}

              {stamp.enabled && (
                <div className="flex justify-center pt-1">
                  <StampPreview config={stamp} size={90} />
                </div>
              )}

              <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                Thank you for your purchase!
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 gap-2" onClick={downloadReceipt}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowReceipt(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
