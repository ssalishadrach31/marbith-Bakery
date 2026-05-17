import { useEffect, useState, useRef } from "react";

// Product images from Unsplash — curated for each product
const PRODUCT_IMAGES: Record<string, string> = {
  "Pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&fit=crop&q=80",
  "Rock Bun": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&fit=crop&q=80",
  "Cakes (6pcs)": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&fit=crop&q=80",
  "Madeira Cake": "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=500&fit=crop&q=80",
  "Vanilla Muffins": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=500&fit=crop&q=80",
  "Egg Rolls": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500&fit=crop&q=80",
  "Sumbusa": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&fit=crop&q=80",
  "Chapattis": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&fit=crop&q=80",
  "Mandazi (6pcs)": "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&fit=crop&q=80",
  "Plain Donuts": "https://images.unsplash.com/photo-1527904324834-3bda86da6771?w=500&fit=crop&q=80",
  "Cookies": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&fit=crop&q=80",
  "Cinnamon Roll": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=500&fit=crop&q=80",
  "Teabites": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&fit=crop&q=80",
  "American Donuts": "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=500&fit=crop&q=80",
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&fit=crop&q=80";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
  currentStock: number;
}

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

// Determine the API base URL (same domain, relative path)
const API_BASE = "/api";

// Order form URL — web app's public order form
const ORDER_URL = "/order";
const WEB_APP_URL = "/";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const scrollY = useScrollY();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((data: Product[]) => {
        setProducts(data.filter((p) => p.isActive));
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── NAV ────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrollY > 60
            ? "bg-white/95 backdrop-blur-md shadow-md"
            : "bg-transparent"
        }`}
      >
        <div className="container-max flex items-center justify-between px-4 h-16">
          <a href="#home" className="flex items-center gap-2">
            <span className="text-2xl">🥐</span>
            <div>
              <div
                className={`font-serif font-bold text-lg leading-none ${
                  scrollY > 60 ? "text-amber-800" : "text-white"
                }`}
              >
                Marbith Bakery
              </div>
              <div
                className={`text-xs tracking-widest uppercase ${
                  scrollY > 60 ? "text-amber-600" : "text-amber-200"
                }`}
              >
                & Investments
              </div>
            </div>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {[
              ["#products", "Our Menu"],
              ["#why-us", "Why Us"],
              ["#wholesale", "Wholesale"],
              ["#delivery", "Delivery"],
              ["#location", "Location"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors hover:text-amber-500 ${
                  scrollY > 60 ? "text-stone-700" : "text-white/90"
                }`}
              >
                {label}
              </a>
            ))}
            <a
              href={ORDER_URL}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors shadow"
            >
              Order Now
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <div className={`w-6 h-0.5 mb-1.5 transition-colors ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
            <div className={`w-6 h-0.5 mb-1.5 transition-colors ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
            <div className={`w-4 h-0.5 transition-colors ${scrollY > 60 ? "bg-stone-800" : "bg-white"}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/98 backdrop-blur-md border-t border-amber-100 px-4 py-4">
            <div className="flex flex-col gap-4">
              {[
                ["#products", "Our Menu"],
                ["#why-us", "Why Us"],
                ["#wholesale", "Wholesale"],
                ["#delivery", "Delivery"],
                ["#location", "Location"],
                ["#contact", "Contact"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-stone-700 font-medium"
                >
                  {label}
                </a>
              ))}
              <a
                href={ORDER_URL}
                className="bg-amber-600 text-white text-center font-semibold px-5 py-2 rounded-full"
              >
                Order Now
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&fit=crop&q=85')",
          }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 hero-overlay" />

        {/* Content */}
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-amber-300 text-xs font-semibold tracking-[0.2em] uppercase px-5 py-2 rounded-full mb-8">
            🍞 Freshly Baked Daily — Namasuba, Kampala
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Marbith Bakery
            <span className="block text-amber-400">&amp; Investments</span>
          </h1>
          <p className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl mx-auto leading-relaxed">
            Kampala's finest artisan bakery. From golden bread to custom cakes,
            we bake with passion every single day — for individuals, families,
            and businesses across Uganda.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={ORDER_URL}
              className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold px-8 py-4 rounded-full text-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/40 hover:scale-105"
            >
              Place an Order
            </a>
            <a
              href="#products"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-full text-lg transition-all duration-200"
            >
              See Our Menu ↓
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              ["14+", "Products"],
              ["2015", "Since"],
              ["100+", "Daily Orders"],
            ].map(([val, label]) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-serif font-bold text-amber-400">{val}</div>
                <div className="text-white/70 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center p-1">
            <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ───────────────────────────────────── */}
      <section id="products" className="section-pad bg-stone-50">
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Fresh Every Day
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-4">
              Our Menu &amp; Prices
            </h2>
            <p className="text-stone-500 text-lg max-w-xl mx-auto">
              All prices in Ugandan Shillings. Every item baked fresh daily from the finest ingredients.
            </p>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-stone-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                    <div className="h-5 bg-amber-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="product-card bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 group"
                >
                  <div className="relative overflow-hidden h-48">
                    <img
                      src={PRODUCT_IMAGES[p.name] || FALLBACK_IMAGE}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-3 inset-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <a
                        href={ORDER_URL}
                        className="block text-center bg-amber-500 text-white text-xs font-bold py-2 rounded-full hover:bg-amber-400 transition-colors"
                      >
                        Order This →
                      </a>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-800 mb-1 text-sm leading-tight">{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-amber-700 text-lg">
                        {formatUGX(p.price)}
                      </span>
                      <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full capitalize">
                        {p.unit ?? "piece"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <a
              href={ORDER_URL}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-10 py-4 rounded-full text-lg transition-all duration-200 shadow-lg hover:shadow-amber-600/30 hover:scale-105"
            >
              🛒 Place an Order Now
            </a>
            <p className="text-stone-400 text-sm mt-3">
              Order online and we'll have it ready for pickup or delivery.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHY US ─────────────────────────────────────── */}
      <section
        id="why-us"
        className="section-pad relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1c0a00 0%, #3d1a00 50%, #5c2c0a 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />

        <div className="container-max relative z-10">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-600/20 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Our Promise
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">
              What We Do Best
            </h2>
            <p className="text-amber-200/70 text-lg max-w-xl mx-auto">
              At Marbith Bakery, quality isn't an option — it's the standard we hold ourselves to every morning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🥖",
                title: "Freshly Baked Daily",
                desc: "We start baking before sunrise so you always get the freshest bread, pastries, and treats straight from the oven — never day-old, always delicious.",
              },
              {
                icon: "🎂",
                title: "Custom Celebration Cakes",
                desc: "Birthdays, weddings, graduations — our bakers craft custom cakes made exactly to your vision, with flavors and designs that'll wow your guests.",
              },
              {
                icon: "🚚",
                title: "Fast Delivery",
                desc: "Order online and we'll deliver right to your door anywhere across Kampala. Hot, fresh, on time — our riders are ready.",
              },
              {
                icon: "🏢",
                title: "Wholesale Supplies",
                desc: "Hotels, restaurants, schools, and supermarkets — we supply premium baked goods in bulk at competitive wholesale prices with consistent quality.",
              },
              {
                icon: "🌾",
                title: "Quality Ingredients",
                desc: "We use only the finest locally-sourced and imported ingredients. No shortcuts, no compromise. Every bite tells you the difference.",
              },
              {
                icon: "❤️",
                title: "Baked with Love",
                desc: "Since 2015, every loaf, every pastry, every cake has been made with the same care and passion our founders instilled in us from day one.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-colors duration-300"
              >
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
              <span className="inline-block bg-amber-200 text-amber-800 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
                For Businesses
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-6 leading-tight">
                Wholesale &amp;<br />Bulk Orders
              </h2>
              <p className="text-stone-600 text-lg mb-6 leading-relaxed">
                Are you a hotel, restaurant, school, or supermarket? We supply fresh baked goods
                in bulk quantities every day. Our wholesale program offers:
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Competitive bulk pricing on all products",
                  "Daily fresh delivery to your premises",
                  "Flexible minimum order quantities",
                  "Dedicated account manager",
                  "Credit terms available for verified businesses",
                  "Custom packaging with your branding",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span className="text-stone-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4">
                <a
                  href="mailto:martha@marbithbakery.com"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-3 rounded-full transition-colors"
                >
                  Enquire Now
                </a>
                <a
                  href="https://wa.me/256700000000?text=Hi%20Marbith%20Bakery%2C%20I'm%20interested%20in%20wholesale%20supplies."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-full transition-colors"
                >
                  WhatsApp Us
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="https://images.unsplash.com/photo-1534432182912-63863115e106?w=400&fit=crop&q=80"
                  alt="Bakery wholesale"
                  className="rounded-2xl object-cover h-52 w-full"
                />
                <img
                  src="https://images.unsplash.com/photo-1606101273945-e9eba057e3b7?w=400&fit=crop&q=80"
                  alt="Bakery products"
                  className="rounded-2xl object-cover h-52 w-full mt-6"
                />
                <img
                  src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&fit=crop&q=80"
                  alt="Fresh bread"
                  className="rounded-2xl object-cover h-52 w-full -mt-6"
                />
                <img
                  src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&fit=crop&q=80"
                  alt="Baking"
                  className="rounded-2xl object-cover h-52 w-full"
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-amber-600 text-white rounded-2xl px-6 py-4 shadow-xl">
                <div className="font-serif text-2xl font-bold">10+</div>
                <div className="text-xs text-amber-200">Years of Excellence</div>
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
              <img
                src="https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&fit=crop&q=80"
                alt="Delivery"
                className="rounded-3xl object-cover w-full h-96 shadow-2xl"
              />
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
              <span className="inline-block bg-green-100 text-green-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
                We Come to You
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-6 leading-tight">
                Delivery Right<br />to Your Door
              </h2>
              <p className="text-stone-600 text-lg mb-6 leading-relaxed">
                Don't have time to pick up? No problem. Our delivery riders cover Namasuba and
                the greater Kampala area. Place your order online, sit back, and enjoy.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: "⚡", label: "Same-Day Delivery", sub: "Order before 2 PM" },
                  { icon: "📍", label: "Kampala-wide", sub: "All major areas covered" },
                  { icon: "📦", label: "Safe Packaging", sub: "Arrives fresh & intact" },
                  { icon: "📱", label: "Order Tracking", sub: "Know where your order is" },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3 bg-stone-50 rounded-xl p-4">
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <div className="font-semibold text-stone-800 text-sm">{f.label}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={ORDER_URL}
                className="inline-flex items-center gap-3 bg-stone-900 hover:bg-stone-700 text-white font-bold px-8 py-4 rounded-full text-lg transition-colors"
              >
                🛒 Order for Delivery
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOCATION ───────────────────────────────────── */}
      <section id="location" className="section-pad bg-stone-100">
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Find Us
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-800 mb-4">
              Our Location
            </h2>
            <p className="text-stone-500 text-lg">
              Visit us in Namasuba, Kampala — we're always open and ready to serve you.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 items-stretch">
            {/* Map embed */}
            <div className="lg:col-span-3 rounded-3xl overflow-hidden shadow-xl h-80 lg:h-auto bg-stone-200">
              <iframe
                title="Marbith Bakery Location"
                width="100%"
                height="100%"
                style={{ minHeight: 320, border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.openstreetmap.org/export/embed.html?bbox=32.5200%2C0.2500%2C32.5600%2C0.2900&layer=mapnik&marker=0.2700%2C32.5400"
              />
            </div>

            {/* Info */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="text-2xl mb-2">📍</div>
                <h3 className="font-serif font-bold text-stone-800 text-xl mb-1">Main Bakery</h3>
                <p className="text-stone-600">Namasuba, Kampala</p>
                <p className="text-stone-400 text-sm">Uganda</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="text-2xl mb-2">🕐</div>
                <h3 className="font-serif font-bold text-stone-800 text-xl mb-2">Opening Hours</h3>
                <div className="space-y-1 text-sm">
                  {[
                    ["Monday – Friday", "6:00 AM – 8:00 PM"],
                    ["Saturday", "6:00 AM – 9:00 PM"],
                    ["Sunday", "7:00 AM – 7:00 PM"],
                  ].map(([day, time]) => (
                    <div key={day} className="flex justify-between text-stone-600">
                      <span>{day}</span>
                      <span className="font-medium text-stone-800">{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="text-2xl mb-2">🚗</div>
                <h3 className="font-serif font-bold text-stone-800 text-xl mb-1">How to Find Us</h3>
                <p className="text-stone-600 text-sm leading-relaxed">
                  Located in Namasuba, just off the Entebbe Highway. Look for the big 
                  bakery sign — our aroma will guide you!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────── */}
      <section
        id="contact"
        className="section-pad"
        style={{
          background: "linear-gradient(135deg, #1c0a00 0%, #3d1a00 100%)",
        }}
      >
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="inline-block bg-amber-600/20 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4">
              Get In Touch
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">
              Contact Us
            </h2>
            <p className="text-amber-200/70 text-lg max-w-xl mx-auto">
              Got a question, a large order, or just want to say hello? Reach out — we'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: "👤",
                role: "General Manager",
                name: "Martha Namulindwa",
                email: "martha@marbithbakery.com",
                note: "Orders, wholesale, partnerships",
              },
              {
                icon: "💻",
                role: "Operations & Tech",
                name: "Shadrach Ssali",
                email: "shadrachssali@gmail.com",
                note: "System, online orders, support",
              },
              {
                icon: "📱",
                role: "WhatsApp Orders",
                name: "Marbith Bakery",
                email: "wa.me/256700000000",
                note: "Fastest way to order",
                isWhatsApp: true,
              },
            ].map((c) => (
              <div
                key={c.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 text-center hover:bg-white/10 transition-colors"
              >
                <div className="text-4xl mb-4">{c.icon}</div>
                <div className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">{c.role}</div>
                <h3 className="font-serif text-xl font-bold text-white mb-1">{c.name}</h3>
                <p className="text-amber-200/60 text-xs mb-4">{c.note}</p>
                {c.isWhatsApp ? (
                  <a
                    href={`https://${c.email}?text=Hello%20Marbith%20Bakery!`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-bold px-5 py-2 rounded-full transition-colors wa-pulse"
                  >
                    📲 Chat on WhatsApp
                  </a>
                ) : (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-block text-amber-400 hover:text-amber-300 text-sm font-medium underline underline-offset-2 transition-colors"
                  >
                    {c.email}
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* CTA banner */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-3xl p-10 text-center">
            <h3 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Order?
            </h3>
            <p className="text-amber-100 text-lg mb-6 max-w-xl mx-auto">
              Use our online order form and get your favourite baked goods delivered fresh to your door.
            </p>
            <a
              href={ORDER_URL}
              className="inline-flex items-center gap-2 bg-white text-amber-700 hover:bg-amber-50 font-bold px-10 py-4 rounded-full text-lg transition-colors shadow-lg"
            >
              🥐 Order Online Now →
            </a>
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
              <p className="text-stone-400 text-sm leading-relaxed max-w-xs">
                Kampala's finest artisan bakery since 2015. Freshly baked daily, delivered with love from Namasuba.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-200 mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {[
                  ["#products", "Our Menu"],
                  ["#why-us", "Why Us"],
                  ["#wholesale", "Wholesale"],
                  ["#delivery", "Delivery"],
                  ["#location", "Location"],
                  [ORDER_URL, "Place an Order"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="hover:text-amber-400 transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-200 mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>📍 Namasuba, Kampala, Uganda</li>
                <li>
                  <a href="mailto:martha@marbithbakery.com" className="hover:text-amber-400 transition-colors">
                    martha@marbithbakery.com
                  </a>
                </li>
                <li>
                  <a href="mailto:shadrachssali@gmail.com" className="hover:text-amber-400 transition-colors">
                    shadrachssali@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href={WEB_APP_URL}
                    className="hover:text-amber-400 transition-colors text-amber-600"
                  >
                    Staff Login →
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
            <span>© {new Date().getFullYear()} Marbith Bakery & Investments. All rights reserved.</span>
            <span>Made with ❤️ in Kampala, Uganda</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/256700000000?text=Hello%20Marbith%20Bakery!%20I'd%20like%20to%20place%20an%20order."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-400 text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg wa-pulse transition-transform hover:scale-110"
        title="Order via WhatsApp"
      >
        💬
      </a>
    </div>
  );
}
