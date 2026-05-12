import { useLocation } from "wouter";
import { getUser, removeToken } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { useState } from "react";
import {
  LayoutDashboard,
  Factory,
  Package,
  ShoppingCart,
  ClipboardList,
  Truck,
  Store,
  Users,
  CreditCard,
  Tag,
  Menu,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/production", label: "Production", icon: Factory, roles: ["admin", "staff"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["admin"] },
  { href: "/pos", label: "POS / Sales", icon: ShoppingCart, roles: ["admin", "staff"] },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["admin"] },
  { href: "/deliveries", label: "Deliveries", icon: Truck, roles: ["admin"] },
  { href: "/wholesale", label: "Wholesale", icon: Store, roles: ["admin"] },
  { href: "/employees", label: "Employees", icon: Users, roles: ["admin"] },
  { href: "/payments", label: "Payments", icon: CreditCard, roles: ["admin"] },
  { href: "/products", label: "Products", icon: Tag, roles: ["admin"] },
  { href: "/users", label: "User Management", icon: ShieldCheck, roles: ["admin"] },
  { href: "/rider-deliveries", label: "My Deliveries", icon: Truck, roles: ["rider"] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = navItems.filter((item) => user && item.roles.includes(user.role));

  function handleLogout() {
    removeToken();
    queryClient.clear();
    navigate("/login");
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-sidebar-primary font-bold text-lg tracking-tight leading-tight">
          Marbith Bakery
          <br />
          <span className="text-xs font-normal text-sidebar-foreground/50 tracking-normal">& Investments</span>
        </div>
        <div className="text-sidebar-foreground/60 text-xs mt-1">{user?.name} &mdash; {user?.role}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              onClick={() => { navigate(item.href); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-sidebar z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-primary">Marbith Bakery</span>
          <div className="w-5" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
