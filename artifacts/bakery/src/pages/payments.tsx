import { useListPayments, useGetRevenueBreakdown, useRecordPayment, getListPaymentsQueryKey, getGetRevenueBreakdownQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX, formatDateTime } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function PaymentsPage() {
  const today = new Date().toISOString().split("T")[0];
  const { data: payments, isLoading } = useListPayments({ params: { date: today }, query: { queryKey: getListPaymentsQueryKey({ date: today }) } });
  const { data: breakdown } = useGetRevenueBreakdown({ params: { date: today }, query: { queryKey: getGetRevenueBreakdownQueryKey({ date: today }) } });
  const recordPayment = useRecordPayment();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ transactionId: "", network: "mtn_momo", amount: "", phoneNumber: "", notes: "" });

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    try {
      await recordPayment.mutateAsync({ data: { ...form, network: form.network as "mtn_momo" | "airtel_money" | "cash", amount: parseFloat(form.amount) } });
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRevenueBreakdownQueryKey() });
      setShowForm(false);
      setForm({ transactionId: "", network: "mtn_momo", amount: "", phoneNumber: "", notes: "" });
      toast({ title: "Payment recorded" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Mobile Money Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleRecord} className="space-y-3">
            <div>
              <Label>Network</Label>
              <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                  <SelectItem value="airtel_money">Airtel Money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}
