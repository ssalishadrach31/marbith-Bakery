import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken, setUser } from "@/lib/auth";
import { getRoleHome } from "@/components/layout";
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
      navigate(getRoleHome(result.user.role));
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
              <Label htmlFor="username" className="text-sm font-medium">Email</Label>
              <Input
                id="username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@marbithbakery.com"
                className="mt-1"
                required
                autoComplete="username"
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
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-sidebar-foreground/40 mt-4">
          <a href="/order" className="underline underline-offset-2 hover:text-sidebar-foreground/60">Place an online order</a>
        </p>
        <p className="text-center text-xs text-sidebar-foreground/25 mt-3">
          Developed by <span className="text-sidebar-foreground/40 font-medium">Shadrach Ssali</span>
        </p>
      </div>
    </div>
  );
}
