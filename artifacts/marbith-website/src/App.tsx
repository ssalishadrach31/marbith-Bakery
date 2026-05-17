import { useEffect, useState } from "react";

// Real cake photos from the bakery
import birthdayCakeImg from "@assets/WhatsApp_Image_2026-05-17_at_5.08.55_PM_1779025116563.jpeg";
import caramelCakeImg from "@assets/WhatsApp_Image_2026-05-17_at_5.08.56_PM_(1)_1779025116563.jpeg";
import graduationCakeImg from "@assets/WhatsApp_Image_2026-05-17_at_5.08.56_PM_1779025116564.jpeg";
import menuDisplayImg from "@assets/image_ed210f43_1779024948588.png";
import cakes6pcsImg from "@assets/Screenshot_2026-05-17_183140_1779028332743.png";
import chapattisImg from "@assets/Screenshot_2026-05-17_180902_1779027079544.png";
import plainDonutsImg from "@assets/Screenshot_2026-05-17_180938_1779027079545.png";
import americanDonutsImg from "@assets/Screenshot_2026-05-17_180956_1779027079546.png";
import vanillaMuffinsImg from "@assets/Screenshot_2026-05-17_181045_1779027079546.png";

// Curated Unsplash images matched to each product name
const PRODUCT_IMAGES: Record<string, string> = {
  "Pizza":            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&fit=crop&q=85",
  "Rock Bun":         "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=600&fit=crop&q=85",
  "Cakes (6pcs)":     cakes6pcsImg,
  "Madeira Cake":     "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=600&fit=crop&q=85",
  "Vanilla Muffins":  vanillaMuffinsImg,
  "Egg Rolls":        "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600&fit=crop&q=85",
  "Sumbusa":          "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&fit=crop&q=85",
  "Chapattis":        chapattisImg,
  "Mandazi (6pcs)":   "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&fit=crop&q=85",
  "Plain Donuts":     plainDonutsImg,
  "Cookies":          "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&fit=crop&q=85",
  "Cinnamon Roll":    "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&fit=crop&q=85",
  "Teabites":         "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&fit=crop&q=85",
  "American Donuts":  americanDonutsImg,
  "Loaf Bread":       "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&fit=crop&q=85",
  "Juice":            "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&fit=crop&q=85",
  "Tea":              "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&fit=crop&q=85",
  "Coffee":           "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&fit=crop&q=85",
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&fit=crop&q=80";

function getProductImage(name: string): string {
  if (PRODUCT_IMAGES[name]) return PRODUCT_IMAGES[name];
  const n = name.toLowerCase();
  if (n.includes("juice"))                    return PRODUCT_IMAGES["Juice"]!;
  if (n.includes("tea"))                      return PRODUCT_IMAGES["Tea"]!;
  if (n.includes("coffee"))                   return PRODUCT_IMAGES["Coffee"]!;
  if (n.includes("pizza"))                    return PRODUCT_IMAGES["Pizza"]!;
  if (n.includes("donut") || n.includes("doughnut")) return PRODUCT_IMAGES["Plain Donuts"]!;
  if (n.includes("muffin"))                   return PRODUCT_IMAGES["Vanilla Muffins"]!;
  if (n.includes("mandazi"))                  return PRODUCT_IMAGES["Mandazi (6pcs)"]!;
  if (n.includes("cookie") || n.includes("biscuit")) return PRODUCT_IMAGES["Cookies"]!;
  if (n.includes("cinnamon"))                 return PRODUCT_IMAGES["Cinnamon Roll"]!;
  if (n.includes("roll"))                     return PRODUCT_IMAGES["Egg Rolls"]!;
  if (n.includes("chapati"))                  return PRODUCT_IMAGES["Chapattis"]!;
  if (n.includes("sumbusa") || n.includes("samosa")) return PRODUCT_IMAGES["Sumbusa"]!;
  if (n.includes("madeira") || n.includes("loaf"))   return PRODUCT_IMAGES["Madeira Cake"]!;
  if (n.includes("cake") || n.includes("cupcake"))   return PRODUCT_IMAGES["Cakes (6pcs)"]!;
  if (n.includes("bun") || n.includes("bread"))      return PRODUCT_IMAGES["Rock Bun"]!;
  return FALLBACK_IMAGE;
}

// Display order for products on the public menu
const DISPLAY_ORDER = [
  "Loaf Bread","Rock Bun","Chapattis","Mandazi (6pcs)","Plain Donuts","American Donuts",
  "Cakes (6pcs)","Madeira Cake","Vanilla Muffins","Cinnamon Roll","Egg Rolls","Teabites",
  "Cookies","Sumbusa","Pizza","Juice","Tea","Coffee",
];

interface Product {
  id: number;
  name: string;
  price: number;
  unit?: string;
  category: string;
  isActive: boolean;
}

// Static fallback — shown when the API is unreachable (e.g. Vercel without VITE_API_URL)
const STATIC_PRODUCTS: Product[] = [
  { id:1,  name:"Loaf Bread",       price:3500, unit:"loaf",   category:"baked_goods", isActive:true },
  { id:2,  name:"Rock Bun",          price:1500, unit:"piece",  category:"baked_goods", isActive:true },
  { id:3,  name:"Chapattis",         price:1000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:4,  name:"Mandazi (6pcs)",    price:2500, unit:"6pcs",   category:"baked_goods", isActive:true },
  { id:5,  name:"Plain Donuts",      price:1000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:6,  name:"American Donuts",   price:2000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:7,  name:"Cakes (6pcs)",      price:2500, unit:"6pcs",   category:"cakes",       isActive:true },
  { id:8,  name:"Madeira Cake",      price:1000, unit:"slice",  category:"cakes",       isActive:true },
  { id:9,  name:"Vanilla Muffins",   price:2000, unit:"piece",  category:"cakes",       isActive:true },
  { id:10, name:"Cinnamon Roll",     price:1000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:11, name:"Egg Rolls",         price:2000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:12, name:"Teabites",          price:3000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:13, name:"Cookies",           price:1000, unit:"piece",  category:"baked_goods", isActive:true },
  { id:14, name:"Sumbusa",           price:1000, unit:"piece",  category:"savoury",     isActive:true },
  { id:15, name:"Pizza",             price:5000, unit:"piece",  category:"savoury",     isActive:true },
];

function formatUGX(n: number) {
  return `UGX ${Number(n).toLocaleString()}`;
}

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const fn = () => setY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return y;
}

const API_BASE    = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") + "/api";
const WEB_APP_URL = "/";
const WA_MARTHA   = "256786111030";
const WA_SHADRACH = "256751900731";

// ── ORDER MODAL ─────────────────────────────────────────────────────────────
function OrderModal({ open, onClose, products, apiBase }: {
  open: boolean; onClose: () => void; products: Product[]; apiBase: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mtn_momo" | "airtel_money">("cash");
  const [txId, setTxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1); setCart({}); setName(""); setPhone(""); setAddress("");
        setPaymentMethod("cash"); setTxId(""); setSubmitting(false);
        setOrderId(null); setFormError("");
      }, 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, quantity]) => ({ productId: Number(id), quantity }));

  const total = cartItems.reduce((sum, item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return sum + (p?.price ?? 0) * item.quantity;
  }, 0);

  const setQty = (id: number, qty: number) =>
    setCart((prev) => ({ ...prev, [id]: Math.max(0, qty) }));

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setFormError("Please fill in all required fields."); return;
    }
    if (cartItems.length === 0) {
      setFormError("Please add at least one item."); return;
    }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          deliveryLocation: address.trim(),
          paymentMethod,
          transactionId: txId.trim() || undefined,
          items: cartItems,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setOrderId(data.id);
    } catch {
      setFormError("Could not place order. Please try WhatsApp instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <div>
              <h2 className="font-serif font-bold text-stone-800">Place Your Order</h2>
              <p className="text-xs text-stone-500">Marbith Bakery & Investments</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-600 text-sm font-bold transition-colors">✕</button>
        </div>

        {/* Success screen */}
        {orderId !== null ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="font-serif text-2xl font-bold text-stone-800 mb-2">Order Placed!</h3>
            <p className="text-stone-500 mb-1">Order <span className="font-bold text-amber-700">#{orderId}</span> has been received.</p>
            <p className="text-stone-400 text-sm mb-8">We'll call <strong>{phone}</strong> to confirm your delivery.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href={`https://wa.me/256786111030?text=Hi%20Marbith%20Bakery!%20I%20just%20placed%20order%20%23${orderId}.`}
                target="_blank" rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors">
                📲 Confirm on WhatsApp
              </a>
              <button onClick={onClose} className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-6 py-2.5 rounded-full text-sm transition-colors">Close</button>
            </div>
          </div>
        ) : (
          <>
            {/* Step tabs */}
            <div className="flex border-b border-stone-100 flex-shrink-0">
              {(["1. Select Items", "2. Your Details"] as const).map((label, i) => (
                <button key={label} onClick={() => { if (i === 0) setStep(1); }}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${step === i + 1 ? "text-amber-700 border-b-2 border-amber-600 bg-amber-50/40" : "text-stone-400"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {step === 1 ? (
                <div className="p-5">
                  {products.length === 0 ? (
                    <p className="text-stone-400 text-center py-10">Loading products…</p>
                  ) : (
                    <div className="space-y-1">
                      {products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-stone-50 last:border-0">
                          <div className="flex-1 min-w-0 mr-4">
                            <span className="font-medium text-stone-800 text-sm">{p.name}</span>
                            <span className="text-amber-600 text-xs font-bold ml-2">{formatUGX(p.price)}</span>
                            {p.unit && <span className="text-stone-400 text-xs ml-1">/ {p.unit}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setQty(p.id, (cart[p.id] || 0) - 1)}
                              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-amber-100 text-stone-600 font-bold flex items-center justify-center transition-colors">−</button>
                            <span className="w-5 text-center font-bold text-stone-800 text-sm">{cart[p.id] || 0}</span>
                            <button onClick={() => setQty(p.id, (cart[p.id] || 0) + 1)}
                              className="w-7 h-7 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center transition-colors">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {cartItems.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Order Summary</p>
                      {cartItems.map((item) => {
                        const p = products.find((pr) => pr.id === item.productId);
                        return p ? (
                          <div key={item.productId} className="flex justify-between text-sm text-stone-700">
                            <span>{p.name} × {item.quantity}</span>
                            <span className="font-medium">{formatUGX(p.price * item.quantity)}</span>
                          </div>
                        ) : null;
                      })}
                      <div className="border-t border-amber-200 mt-2 pt-2 flex justify-between font-bold text-stone-800 text-sm">
                        <span>Total</span><span className="text-amber-700">{formatUGX(total)}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Full Name *</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Nakato"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Phone Number *</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" type="tel"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Delivery Address *</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Ntinda, Plot 12, near Shell petrol station"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Payment Method *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([["cash","💵 Cash"],["mtn_momo","🟡 MTN MoMo"],["airtel_money","🔴 Airtel"]] as const).map(([val, label]) => (
                        <button key={val} onClick={() => setPaymentMethod(val)}
                          className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${paymentMethod === val ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-500 hover:border-amber-200"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {paymentMethod !== "cash" && (
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Transaction ID <span className="text-stone-400 normal-case font-normal">(optional)</span></label>
                      <input value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="e.g. AB12345678"
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
                    </div>
                  )}
                  {formError && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2">{formError}</p>}
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex justify-between items-center gap-3 flex-shrink-0">
              {step === 1 ? (
                <>
                  <p className="text-xs text-stone-400">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""} · {formatUGX(total)}</p>
                  <button onClick={() => { if (cartItems.length === 0) { setFormError("Add at least one item first."); return; } setFormError(""); setStep(2); }}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-7 py-2.5 rounded-full text-sm transition-colors">
                    Next: Details →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setStep(1)} className="text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors">← Back</button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold px-7 py-2.5 rounded-full text-sm transition-colors">
                    {submitting ? "Placing…" : "🛒 Confirm Order"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const scrollY = useScrollY();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data.filter((p) => p.isActive)))
      .catch(() => {
        // API unavailable (e.g. Vercel deployment without VITE_API_URL set)
        // Fall back to static product list so the menu always renders
        setProducts(STATIC_PRODUCTS);
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  // Sort products by preferred display order, remaining ones appended at end
  const sortedProducts = [...products].sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a.name);
    const bi = DISPLAY_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="min-h-screen bg-background">

      {/* ── NAV ────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 60 ? "bg-white/95 backdrop-blur-md shadow-md" : "bg-transparent"}`}>
        <div className="container-max flex items-center justify-between px-4 h-16">
          <a href="#home" className="flex items-center gap-2">
            <span className="text-2xl">🥐</span>
            <div>
              <div className={`font-serif font-bold text-lg leading-none ${scrollY > 60 ? "text-amber-800" : "text-white"}`}>Marbith Bakery</div>
              <div className={`text-xs tracking-widest uppercase ${scrollY > 60 ? "text-amber-600" : "text-amber-200"}`}>& Investments</div>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-6">
            {[["#products","Our Menu"],["#custom-cakes","Custom Cakes"],["#why-us","Why Us"],["#wholesale","Wholesale"],["#location","Location"],["#contact","Contact"]].map(([href,label])=>(
              <a key={href} href={href} className={`text-sm font-medium transition-colors hover:text-amber-500 ${scrollY > 60 ? "text-stone-700" : "text-white/90"}`}>{label}</a>
            ))}
            <button onClick={() => setOrderOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors shadow">Order Now</button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <div className={`w-6 h-0.5 mb-1.5 ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
            <div className={`w-6 h-0.5 mb-1.5 ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
            <div className={`w-4 h-0.5   ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white/98 backdrop-blur-md border-t border-amber-100 px-4 py-4">
            <div className="flex flex-col gap-4">
              {[["#products","Our Menu"],["#custom-cakes","Custom Cakes"],["#why-us","Why Us"],["#wholesale","Wholesale"],["#location","Location"],["#contact","Contact"]].map(([href,label])=>(
                <a key={href} href={href} onClick={()=>setMobileMenuOpen(false)} className="text-stone-700 font-medium">{label}</a>
              ))}
              <button onClick={() => { setMobileMenuOpen(false); setOrderOpen(true); }} className="bg-amber-600 text-white text-center font-semibold px-5 py-2 rounded-full">Order Now</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=1600&fit=crop&q=85')" }} />
        <div className="absolute inset-0 hero-overlay" />

        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-amber-300 text-xs font-semibold tracking-[0.2em] uppercase px-5 py-2 rounded-full mb-8">
            🍞 Freshly Baked Daily — Namasuba Parish, Kampala
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Marbith Bakery
            <span className="block text-amber-400">&amp; Investments</span>
          </h1>
          <p className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl mx-auto leading-relaxed">
            Kampala's finest artisan bakery. From golden bread to custom cakes,
            we bake with passion every single day — for individuals, families, and businesses across Uganda.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => setOrderOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold px-8 py-4 rounded-full text-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/40 hover:scale-105">
              Place an Order
            </button>
            <a href="#products" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-full text-lg transition-all duration-200">
              See Our Menu ↓
            </a>
          </div>

          <div className="mt-20 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[["20+","Products"],["2024","Est."],["100+","Daily Orders"]].map(([val,label])=>(
              <div key={label} className="text-center">
                <div className="text-3xl font-serif font-bold text-amber-400">{val}</div>
                <div className="text-white/70 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center p-1">
            <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ───────────────────────────────────── */}
      <section id="products" className="section-pad bg-stone-50">
        <div className="container-max">
          <div className="text-center mb-10">
            <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Fresh Every Day
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-4">Our Menu &amp; Prices</h2>
            <p className="text-stone-500 text-lg max-w-xl mx-auto">
              All prices in Ugandan Shillings. Every item freshly prepared daily from the finest ingredients.
            </p>
          </div>

          {/* Menu showcase photo */}
          <div className="mb-12 rounded-3xl overflow-hidden shadow-2xl">
            <img src={menuDisplayImg} alt="Marbith Bakery full menu display" className="w-full object-cover max-h-72 md:max-h-96" />
          </div>

          {/* Individual product cards — all visible at once */}
          {loadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse shadow-sm">
                  <div className="h-52 bg-stone-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                    <div className="h-5 bg-amber-100 rounded w-1/2" />
                    <div className="h-9 bg-stone-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {sortedProducts.map((p) => (
                <div
                  key={p.id}
                  className="group bg-white rounded-3xl overflow-hidden shadow-md border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  {/* Photo */}
                  <div className="relative overflow-hidden h-52 flex-shrink-0">
                    <img
                      src={getProductImage(p.name)}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    />
                    {/* Price badge on image */}
                    <div className="absolute top-3 right-3 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      {formatUGX(p.price)}
                    </div>
                  </div>

                  {/* Info + button */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <h3 className="font-serif font-bold text-stone-800 text-base leading-tight">{p.name}</h3>
                    <p className="text-stone-400 text-xs">
                      {p.unit ? `Per ${p.unit}` : "Per piece"} · Freshly made daily
                    </p>
                    <button
                      onClick={() => setOrderOpen(true)}
                      className="mt-auto block text-center bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold py-2.5 rounded-full transition-colors shadow-sm hover:shadow-amber-400/40 w-full"
                    >
                      🛒 Place Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-14">
            <p className="text-stone-500 text-base mb-4">Want everything in one go? Place a full order online.</p>
            <button onClick={() => setOrderOpen(true)} className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-700 text-white font-bold px-10 py-4 rounded-full text-lg transition-all duration-200 shadow-lg hover:scale-105">
              🛒 Order Now
            </button>
          </div>
        </div>
      </section>

      {/* ── CUSTOM CAKES ───────────────────────────────── */}
      <section id="custom-cakes" className="section-pad bg-white">
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-pink-100 text-pink-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Made to Order
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-4">Custom Cakes</h2>
            <p className="text-stone-500 text-lg max-w-xl mx-auto">
              Birthdays, graduations, weddings — we craft stunning celebration cakes tailored exactly to you. Price on request.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { img: birthdayCakeImg,    title: "Birthday Cakes",    desc: "Rich, beautifully decorated cakes for your special day. Any flavour, any design." },
              { img: caramelCakeImg,     title: "Celebration Cakes", desc: "Premium multi-layer celebration cakes with custom decorations and premium toppings." },
              { img: graduationCakeImg,  title: "Graduation Cakes",  desc: "Mark life's milestone moments with an elegant, personalised graduation cake." },
            ].map((cake) => (
              <div key={cake.title} className="group rounded-3xl overflow-hidden shadow-lg border border-stone-100">
                <div className="relative overflow-hidden h-72">
                  <img
                    src={cake.img}
                    alt={cake.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                    <h3 className="font-serif text-xl font-bold mb-1">{cake.title}</h3>
                    <p className="text-white/80 text-xs leading-relaxed">{cake.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center">
            <h3 className="font-serif text-2xl font-bold text-stone-800 mb-2">Order Your Custom Cake</h3>
            <p className="text-stone-600 mb-6">Contact us at least 48 hours in advance. Prices vary by size and design.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href={`https://wa.me/${WA_MARTHA}?text=Hello%20Marbith%20Bakery!%20I'd%20like%20to%20order%20a%20custom%20cake.`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-full transition-colors"
              >
                📲 WhatsApp Martha
              </a>
              <a href={`tel:+${WA_MARTHA}`} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-3 rounded-full transition-colors">
                📞 Call to Order
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY US ─────────────────────────────────────── */}
      <section id="why-us" className="section-pad relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1c0a00 0%, #3d1a00 50%, #5c2c0a 100%)" }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="container-max relative z-10">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-600/20 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">Our Promise</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">What We Do Best</h2>
            <p className="text-amber-200/70 text-lg max-w-xl mx-auto">At Marbith Bakery, quality isn't an option — it's the standard we hold ourselves to every morning.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon:"🥖", title:"Freshly Baked Daily",        desc:"We start baking before sunrise so you always get the freshest bread, pastries, and treats straight from the oven — never day-old, always delicious." },
              { icon:"🎂", title:"Custom Celebration Cakes",   desc:"Birthdays, weddings, graduations — our bakers craft custom cakes made exactly to your vision, with flavors and designs that'll wow your guests." },
              { icon:"🚚", title:"Fast Delivery",               desc:"Order online and we'll deliver right to your door anywhere across Kampala. Hot, fresh, on time — our riders are ready." },
              { icon:"🏢", title:"Wholesale Supplies",          desc:"Hotels, restaurants, schools, and supermarkets — we supply premium baked goods in bulk at competitive wholesale prices with consistent quality." },
              { icon:"🌾", title:"Quality Ingredients",         desc:"We use only the finest locally-sourced and imported ingredients. No shortcuts, no compromise. Every bite tells you the difference." },
              { icon:"❤️", title:"Baked with Love",             desc:"Since 2024, every loaf, every pastry, every cake has been made with the same care and passion our founders bring to the table every single day." },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-colors duration-300">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-serif text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-amber-200/70 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHOLESALE ──────────────────────────────────── */}
      <section id="wholesale" className="section-pad bg-amber-50">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-block bg-amber-200 text-amber-800 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">For Businesses</span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-6 leading-tight">Wholesale &amp;<br />Bulk Orders</h2>
              <p className="text-stone-600 text-lg mb-6 leading-relaxed">
                Are you a hotel, restaurant, school, or supermarket? We supply fresh baked goods in bulk quantities every day.
              </p>
              <ul className="space-y-3 mb-8">
                {["Competitive bulk pricing on all products","Daily fresh delivery to your premises","Flexible minimum order quantities","Dedicated account manager","Credit terms available for verified businesses","Custom packaging with your branding"].map((item)=>(
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span className="text-stone-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4">
                <a href="mailto:martha@marbithbakery.com" className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-3 rounded-full transition-colors">Enquire Now</a>
                <a href={`https://wa.me/${WA_MARTHA}?text=Hi%20Marbith%20Bakery%2C%20I'm%20interested%20in%20wholesale%20supplies.`} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-full transition-colors">
                  WhatsApp Us
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <img src="https://images.unsplash.com/photo-1534432182912-63863115e106?w=400&fit=crop&q=80" alt="Bakery wholesale" className="rounded-2xl object-cover h-52 w-full" />
                <img src="https://images.unsplash.com/photo-1606101273945-e9eba057e3b7?w=400&fit=crop&q=80" alt="Bakery products" className="rounded-2xl object-cover h-52 w-full mt-6" />
                <img src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&fit=crop&q=80" alt="Fresh bread" className="rounded-2xl object-cover h-52 w-full -mt-6" />
                <img src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&fit=crop&q=80" alt="Baking" className="rounded-2xl object-cover h-52 w-full" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-amber-600 text-white rounded-2xl px-6 py-4 shadow-xl">
                <div className="font-serif text-2xl font-bold">Est.</div>
                <div className="text-xs text-amber-200">2024</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DELIVERY ───────────────────────────────────── */}
      <section id="delivery" className="section-pad bg-white">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="relative order-2 lg:order-1">
              <img src="https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&fit=crop&q=80" alt="Delivery" className="rounded-3xl object-cover w-full h-96 shadow-2xl" />
              <div className="absolute -top-5 -right-5 bg-amber-500 text-white rounded-2xl p-5 shadow-xl">
                <div className="text-3xl font-serif font-bold">Fast</div>
                <div className="text-xs text-amber-100">Delivery</div>
              </div>
              <div className="absolute -bottom-5 -left-5 bg-stone-800 text-white rounded-2xl px-6 py-4 shadow-xl">
                <div className="font-serif text-xl font-bold">🛵 Same-Day</div>
                <div className="text-xs text-stone-400 mt-0.5">Orders before 2 PM</div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block bg-green-100 text-green-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">We Come to You</span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-6 leading-tight">Delivery Right<br />to Your Door</h2>
              <p className="text-stone-600 text-lg mb-6 leading-relaxed">
                Our delivery riders cover Namasuba Parish and the greater Kampala area. Place your order online, sit back, and enjoy.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon:"⚡", label:"Same-Day Delivery", sub:"Order before 2 PM" },
                  { icon:"📍", label:"Kampala-wide",       sub:"All major areas covered" },
                  { icon:"📦", label:"Safe Packaging",     sub:"Arrives fresh & intact" },
                  { icon:"📱", label:"Order Tracking",     sub:"Know where your order is" },
                ].map((f)=>(
                  <div key={f.label} className="flex items-start gap-3 bg-stone-50 rounded-xl p-4">
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <div className="font-semibold text-stone-800 text-sm">{f.label}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setOrderOpen(true)} className="inline-flex items-center gap-3 bg-stone-900 hover:bg-stone-700 text-white font-bold px-8 py-4 rounded-full text-lg transition-colors">
                🛒 Order for Delivery
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOCATION ───────────────────────────────────── */}
      <section id="location" className="section-pad bg-stone-100">
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">Find Us</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-4">Our Locations</h2>
            <p className="text-stone-500 text-lg">Two convenient locations in Kampala — visit us or order online.</p>
          </div>
          <div className="grid lg:grid-cols-5 gap-8 items-stretch">
            <div className="lg:col-span-3 rounded-3xl overflow-hidden shadow-xl h-80 lg:h-auto bg-stone-200">
              <iframe
                title="Marbith Bakery Location"
                width="100%" height="100%"
                style={{ minHeight: 320, border: 0 }}
                loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade"
                src="https://www.openstreetmap.org/export/embed.html?bbox=32.5700%2C0.2950%2C32.6100%2C0.3350&layer=mapnik&marker=0.3136%2C32.5811"
              />
            </div>
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl">🏪</div>
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">Sale Shop</span>
                </div>
                <h3 className="font-serif font-bold text-stone-800 text-lg mb-1">Totala Business Centre</h3>
                <p className="text-stone-700 font-medium text-sm">Shop TBC 3-55</p>
                <p className="text-stone-600 text-sm">Nakivubo Shironko Shawuliako</p>
                <p className="text-stone-600 text-sm">Nabugabo Street, Kampala</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl">🏭</div>
                  <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-0.5 rounded-full">Production Bakery</span>
                </div>
                <h3 className="font-serif font-bold text-stone-800 text-lg mb-1">Namasuba Parish</h3>
                <p className="text-stone-600 text-sm">Kampala, Uganda</p>
                <p className="text-stone-400 text-xs mt-1">Just off the Entebbe Highway</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="text-2xl mb-2">🕐</div>
                <h3 className="font-serif font-bold text-stone-800 text-xl mb-2">Opening Hours</h3>
                <div className="space-y-1 text-sm">
                  {[["Monday – Friday","6:00 AM – 8:00 PM"],["Saturday","6:00 AM – 9:00 PM"],["Sunday","7:00 AM – 7:00 PM"]].map(([day,time])=>(
                    <div key={day} className="flex justify-between text-stone-600">
                      <span>{day}</span><span className="font-medium text-stone-800">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────── */}
      <section id="contact" className="section-pad" style={{ background: "linear-gradient(135deg, #1c0a00 0%, #3d1a00 100%)" }}>
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-600/20 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">Get In Touch</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-amber-200/70 text-lg max-w-xl mx-auto">Got a question, a large order, or just want to say hello? Reach out — we'd love to hear from you.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-2xl mx-auto">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-7 text-center hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-4">👤</div>
              <div className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">General Manager</div>
              <h3 className="font-serif text-xl font-bold text-white mb-1">Martha Kamazooba Ssali</h3>
              <p className="text-amber-200/60 text-xs mb-4">Orders, wholesale, partnerships</p>
              <div className="flex flex-col gap-2 items-center">
                <a href={`https://wa.me/${WA_MARTHA}?text=Hello%20Marbith%20Bakery!`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-bold px-5 py-2 rounded-full transition-colors wa-pulse">
                  📲 +256 786 111030
                </a>
                <a href="mailto:martha@marbithbakery.com" className="text-amber-400 hover:text-amber-300 text-xs underline underline-offset-2">martha@marbithbakery.com</a>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-7 text-center hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-4">📱</div>
              <div className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">WhatsApp Orders</div>
              <h3 className="font-serif text-xl font-bold text-white mb-1">Order via WhatsApp</h3>
              <p className="text-amber-200/60 text-xs mb-4">Fastest way to place your order</p>
              <a href={`https://wa.me/${WA_MARTHA}?text=Hello%20Marbith%20Bakery!%20I'd%20like%20to%20place%20an%20order.`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-bold px-5 py-2 rounded-full transition-colors wa-pulse">
                📲 Chat on WhatsApp
              </a>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-3xl p-10 text-center">
            <h3 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">Ready to Order?</h3>
            <p className="text-amber-100 text-lg mb-6 max-w-xl mx-auto">Use our online order form and get your favourite baked goods delivered fresh to your door.</p>
            <button onClick={() => setOrderOpen(true)} className="inline-flex items-center gap-2 bg-white text-amber-700 hover:bg-amber-50 font-bold px-10 py-4 rounded-full text-lg transition-colors shadow-lg">
              🥐 Order Online Now →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400 py-10 px-4">
        <div className="container-max">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🥐</span>
                <div>
                  <div className="font-serif font-bold text-white text-xl">Marbith Bakery</div>
                  <div className="text-amber-600 text-xs tracking-widest uppercase">& Investments</div>
                </div>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed max-w-xs">Kampala's finest artisan bakery, established 2024. Freshly baked daily from Namasuba Parish.</p>
              <div className="mt-3 text-xs text-stone-500 space-y-1">
                <p>🏪 Totala Business Centre, Shop TBC 3-55</p>
                <p>Nabugabo Street, Kampala</p>
                <p>🏭 Namasuba Parish, Kampala</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-stone-200 mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {[["#products","Our Menu"],["#custom-cakes","Custom Cakes"],["#why-us","Why Us"],["#wholesale","Wholesale"],["#location","Location"]].map(([href,label])=>(
                  <li key={href}><a href={href} className="hover:text-amber-400 transition-colors">{label}</a></li>
                ))}
                <li><button onClick={() => setOrderOpen(true)} className="hover:text-amber-400 transition-colors text-left">Place an Order</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-200 mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li><a href={`https://wa.me/${WA_MARTHA}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">📲 Martha: +256 786 111030</a></li>
                <li><a href="mailto:martha@marbithbakery.com" className="hover:text-amber-400 transition-colors">martha@marbithbakery.com</a></li>
                <li><a href={WEB_APP_URL} className="hover:text-amber-400 transition-colors text-amber-600">Staff Login →</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
            <span>© {new Date().getFullYear()} Marbith Bakery & Investments. All rights reserved.</span>
            <span>Made with ❤️ in Kampala, Uganda</span>
          </div>
        </div>
      </footer>

      {/* ── DEVELOPER CREDIT ────────────────────────────── */}
      <div className="bg-stone-950 text-stone-500 py-3 px-4 text-center text-xs border-t border-stone-800">
        Developed by <span className="text-amber-500 font-semibold">Shadrach Ssali</span> — Full Stack Developer
      </div>

      {/* Floating WhatsApp button */}
      <a href={`https://wa.me/${WA_MARTHA}?text=Hello%20Marbith%20Bakery!%20I'd%20like%20to%20place%20an%20order.`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-400 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg wa-pulse transition-transform hover:scale-110"
        title="Order via WhatsApp">
        💬
      </a>

      {/* Inline order modal */}
      <OrderModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        products={sortedProducts}
        apiBase={API_BASE}
      />
    </div>
  );
}
