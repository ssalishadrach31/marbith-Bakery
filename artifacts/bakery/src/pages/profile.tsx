import { useState } from "react";
import { getUser, getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, User, Eye, EyeOff, ShieldCheck } from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.json();
}

const ROLE_COLORS: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700",
  staff:   "bg-blue-100 text-blue-700",
  cashier: "bg-yellow-100 text-yellow-700",
  baker:   "bg-orange-100 text-orange-700",
  rider:   "bg-green-100 text-green-700",
};

export default function ProfilePage() {
  const user = getUser();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  async function handleChange() {
    if (!current || !next || !confirm) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    if (next !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (next.length < 6) { toast({ title: "New password must be at least 6 characters", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast({ title: "Password changed", description: "Your password has been updated. Use it next time you log in." });
      setCurrent(""); setNext(""); setConfirm("");
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" /> My Profile
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Account details and security settings.</p>
      </div>

      {/* Account info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm items-center">
            <span className="text-muted-foreground font-medium">Name</span>
            <span className="font-semibold">{user?.name}</span>
            <span className="text-muted-foreground font-medium">Login</span>
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{user?.username}</span>
            <span className="text-muted-foreground font-medium">Role</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit capitalize ${ROLE_COLORS[user?.role ?? ""] ?? "bg-muted"}`}>{user?.role}</span>
            {user?.jobTitle && (
              <>
                <span className="text-muted-foreground font-medium">Job Title</span>
                <span>{user.jobTitle}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Password updated successfully! Use your new password next time you log in.
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Current Password</Label>
            <div className="relative mt-1">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter your current password"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <div className="relative mt-1">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className={`pr-10 ${mismatch ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Passwords do not match
              </p>
            )}
          </div>
          <Button onClick={handleChange} disabled={loading || !!mismatch} className="w-full gap-2">
            <KeyRound className="h-4 w-4" />
            {loading ? "Updating..." : "Change Password"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your password is private. After changing it, you will need to use the new one at your next login.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
