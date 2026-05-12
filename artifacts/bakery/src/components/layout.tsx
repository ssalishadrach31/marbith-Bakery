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
  BarChart2,
  Receipt,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard, roles: ["admin"] },
  { href: "/staff-dashboard", label: "Stock Counts",    icon: BarChart2,       roles: ["admin", "staff", "cashier", "baker"] },
  { href: "/production",      label: "Production",      icon: Factory,         roles: ["admin", "staff", "baker"] },
  { href: "/inventory",       label: "Inventory",       icon: Package,         roles: ["admin"] },
  { href: "/pos",             label: "POS / Sales",     icon: ShoppingCart,    roles: ["admin", "staff", "cashier"] },
  { href: "/orders",          label: "Orders",          icon: ClipboardList,   roles: ["admin"] },
  { href: "/deliveries",      label: "Deliveries",      icon: Truck,           roles: ["admin"] },
  { href: "/wholesale",       label: "Wholesale",       icon: Store,           roles: ["admin"] },
  { href: "/employees",       label: "Employees",       icon: Users,           roles: ["admin"] },
  { href: "/payments",        label: "Payments",        icon: CreditCard,      roles: ["admin"] },
  { href: "/products",        label: "Products",        icon: Tag,             roles: ["admin"] },
  { href: "/expenses",        label: "Expenses",        icon: Receipt,         roles: ["admin", "staff", "cashier", "baker"] },
  { href: "/users",           label: "User Management", icon: ShieldCheck,     roles: ["admin"] },
  { href: "/rider-deliveries",label: "My Deliveries",   icon: Truck,           roles: ["rider"] },
];

// Where each role lands after login
export function getRoleHome(role: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "rider") return "/rider-deliveries";
  if (role === "cashier") return "/staff-dashboard";
  if (role === "baker") return "/staff-dashboard";
  return "/staff-dashboard"; // staff
}

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

  const displayTitle = user?.jobTitle || user?.role || "";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-sidebar-primary font-bold text-lg tracking-tight leading-tight">
          Marbith Bakery
          <br />
          <span className="text-xs font-normal text-sidebar-foreground/50 tracking-normal">& Investments</span>
        </div>
        <div className="text-sidebar-foreground/70 text-xs font-medium mt-1.5">{user?.name}</div>
        <div className="text-sidebar-foreground/40 text-xs">{displayTitle}</div>
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
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
        <p className="text-center text-xs text-sidebar-foreground/25 pt-1">
          Dev: <span className="text-sidebar-foreground/35">Shadrach Ssali</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex flex-col w-60 bg-sidebar shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

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

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-primary">Marbith Bakery</span>
          <div className="w-5" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
