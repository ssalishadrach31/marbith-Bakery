import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken, setUser } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const loginMutation = useLogin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await loginMutation.mutateAsync({ data: { username, password } });
      setToken(result.token);
      setUser(result.user as any);
      queryClient.clear();
      const role = result.user.role;
      if (role === "admin") navigate("/dashboard");
      else if (role === "rider") navigate("/rider-deliveries");
      else navigate("/pos");
    } catch {
      toast({ title: "Login failed", description: "Invalid username or password", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-sidebar-primary mb-0.5 leading-tight">Marbith Bakery</div>
          <div className="text-sidebar-primary/70 font-semibold text-sm">& Investments</div>
          <p className="text-sidebar-foreground/50 text-xs mt-1">Management System</p>
        </div>
        <div className="bg-card rounded-2xl shadow-xl border border-card-border p-7">
          <h2 className="text-lg font-semibold text-foreground mb-5">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
                required
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">Demo credentials</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground text-center">
              <div>Admin: <span className="font-mono">admin / admin123</span></div>
              <div>Staff: <span className="font-mono">cashier1 / staff123</span></div>
              <div>Rider: <span className="font-mono">rider1 / rider123</span></div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-sidebar-foreground/40 mt-4">
          <a href="/order" className="underline underline-offset-2 hover:text-sidebar-foreground/60">Place an online order</a>
        </p>
      </div>
    </div>
  );
}
