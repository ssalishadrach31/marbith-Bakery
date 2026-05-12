import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { getUser, getToken } from "@/lib/auth";
import { getRoleHome } from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ProductionPage from "@/pages/production";
import InventoryPage from "@/pages/inventory";
import POSPage from "@/pages/pos";
import OrdersPage from "@/pages/orders";
import DeliveriesPage from "@/pages/deliveries";
import WholesalePage from "@/pages/wholesale";
import EmployeesPage from "@/pages/employees";
import PaymentsPage from "@/pages/payments";
import ProductsPage from "@/pages/products";
import UsersPage from "@/pages/users";
import OrderFormPage from "@/pages/order-form";
import RiderDeliveriesPage from "@/pages/rider-deliveries";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to={getRoleHome(user.role)} />;
  return <Layout><Component /></Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/order" component={OrderFormPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} roles={["admin"]} />}
      </Route>
      <Route path="/production">
        {() => <ProtectedRoute component={ProductionPage} roles={["admin", "staff", "baker"]} />}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedRoute component={InventoryPage} roles={["admin"]} />}
      </Route>
      <Route path="/pos">
        {() => <ProtectedRoute component={POSPage} roles={["admin", "staff", "cashier"]} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={OrdersPage} roles={["admin"]} />}
      </Route>
      <Route path="/deliveries">
        {() => <ProtectedRoute component={DeliveriesPage} roles={["admin"]} />}
      </Route>
      <Route path="/wholesale">
        {() => <ProtectedRoute component={WholesalePage} roles={["admin"]} />}
      </Route>
      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesPage} roles={["admin"]} />}
      </Route>
      <Route path="/payments">
        {() => <ProtectedRoute component={PaymentsPage} roles={["admin"]} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={ProductsPage} roles={["admin"]} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UsersPage} roles={["admin"]} />}
      </Route>
      <Route path="/rider-deliveries">
        {() => <ProtectedRoute component={RiderDeliveriesPage} roles={["rider"]} />}
      </Route>
      <Route path="/">
        {() => {
          const user = getUser();
          if (!user) return <Redirect to="/login" />;
          return <Redirect to={getRoleHome(user.role)} />;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
