import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useListPayments, useGetRevenueBreakdown, useRecordPayment, getListPaymentsQueryKey, getGetRevenueBreakdownQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); const err: any = new Error(e.error ?? "Request failed"); err.status = res.status; throw err; }
  return res.json();
}

type PaymentForm = { transactionId: string; network: string; amount: string; phoneNumber: string; notes: string };
type EditState = PaymentForm & { id: number };

export default function PaymentsPage() {
  const today = new Date().toISOString().split("T")[0];
  const qc = useQueryClient();
  const { data: payments, isLoading } = useListPayments({ date: today }, { query: { queryKey: getListPaymentsQueryKey({ date: today }) } });
  const { data: breakdown } = useGetRevenueBreakdown({ date: today }, { query: { queryKey: getGetRevenueBreakdownQueryKey({ date: today }) } });
  const recordPayment = useRecordPayment();
  const { toast } = useToast();

  const emptyForm: PaymentForm = { transactionId: "", network: "mtn_momo", amount: "", phoneNumber: "", notes: "" };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [editRecord, setEditRecord] = useState<EditState | null>(null);

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: EditState) =>
      apiFetch(`/payments/${id}`, { method: "PATCH", body: JSON.stringify({ ...body, amount: parseFloat(body.amount) }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRevenueBreakdownQueryKey() });
      toast({ title: "Payment updated" });
      setEditRecord(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    try {
      await recordPayment.mutateAsync({ data: { ...form, network: form.network as "mtn_momo" | "airtel_money" | "cash", amount: parseFloat(form.amount) } });
      qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRevenueBreakdownQueryKey() });
      setShowForm(false);
      setForm(emptyForm);
      toast({ title: "Payment recorded" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  function NetworkSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
          <SelectItem value="airtel_money">Airtel Money</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>Record Payment</Button>
      </div>

      {/* Revenue breakdown */}
      {breakdown && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: breakdown.totalRevenue, highlight: true },
            { label: "Shop Sales", value: breakdown.shopSalesRevenue },
            { label: "Online Orders", value: breakdown.onlineOrdersRevenue },
            { label: "Wholesale", value: breakdown.wholesaleRevenue },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase font-medium">{item.label}</p>
                <p className={`text-xl font-bold mt-1 ${item.highlight ? "text-primary" : "text-foreground"}`}>{formatUGX(item.value)}</p>
              </CardContent>
            </Card>
          ))}
          {[
            { label: "Cash", value: breakdown.cashRevenue },
            { label: "MTN MoMo", value: breakdown.mtnMomoRevenue },
            { label: "Airtel Money", value: breakdown.airtelMoneyRevenue },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase font-medium">{item.label}</p>
                <p className="text-xl font-bold mt-1 text-foreground">{formatUGX(item.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Today's Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : payments && payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">TX ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Network</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Time</th>
                    <th className="py-3 px-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono text-xs">{p.transactionId}</td>
                      <td className="py-3 px-4 capitalize">{p.network.replace(/_/g, " ")}</td>
                      <td className="py-3 px-4 font-bold text-primary">{formatUGX(p.amount)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.phoneNumber}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{formatDateTime(p.recordedAt)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setEditRecord({
                            id: p.id,
                            transactionId: p.transactionId ?? "",
                            network: p.network,
                            amount: String(p.amount),
                            phoneNumber: p.phoneNumber ?? "",
                            notes: p.notes ?? "",
                          })}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit payment"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No payments recorded today</p>
          )}
        </CardContent>
      </Card>

      {/* Record new payment dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Mobile Money Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleRecord} className="space-y-3">
            <div>
              <Label>Network</Label>
              <NetworkSelect value={form.network} onChange={(v) => setForm({ ...form, network: v })} />
            </div>
            <div>
              <Label>Transaction ID</Label>
              <Input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Amount (UGX)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={recordPayment.isPending}>Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit payment dialog */}
      <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Payment Record</DialogTitle></DialogHeader>
          {editRecord && (
            <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(editRecord); }} className="space-y-3">
              <div>
                <Label>Network</Label>
                <NetworkSelect value={editRecord.network} onChange={(v) => setEditRecord({ ...editRecord, network: v })} />
              </div>
              <div>
                <Label>Transaction ID</Label>
                <Input value={editRecord.transactionId} onChange={(e) => setEditRecord({ ...editRecord, transactionId: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Amount (UGX)</Label>
                <Input type="number" value={editRecord.amount} onChange={(e) => setEditRecord({ ...editRecord, amount: e.target.value })} className="mt-1" required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={editRecord.phoneNumber} onChange={(e) => setEditRecord({ ...editRecord, phoneNumber: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={editRecord.notes} onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })} className="mt-1" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
