import { useState } from "react";
import { useGetProductionDailyReport, getGetProductionDailyReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart2, ShoppingCart, TrendingUp, Package } from "lucide-react";

function fmt(n: number) {
  return `UGX ${n.toLocaleString()}`;
}
function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}
function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return ts;
  }
}

const PAY_LABELS: Record<string, string> = {
  cash: "Cash",
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
};

export default function DailyReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useGetProductionDailyReport(
    { date },
    { query: { queryKey: getGetProductionDailyReportQueryKey({ date }) } }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full breakdown of production, stock, and sales — admin only</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm shrink-0">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? (
        <p className="text-muted-foreground text-center py-12">No data for this date</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Revenue
                </div>
                <div className="text-xl font-bold text-primary">{fmt(data.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(date)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" /> Units Sold
                </div>
                <div className="text-xl font-bold">{data.totalUnitsSold}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total items sold</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" /> Transactions
                </div>
                <div className="text-xl font-bold">{data.sales.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Sales receipts</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Package className="h-3.5 w-3.5" /> Products Tracked
                </div>
                <div className="text-xl font-bold">{data.productRows.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">With production entries</div>
              </CardContent>
            </Card>
          </div>

          {/* Production breakdown */}
          {data.productRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Production &amp; Stock Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                        <th className="text-center py-3 px-3 font-medium text-amber-600">Leftover</th>
                        <th className="text-center py-3 px-3 font-medium text-green-600">New Batch</th>
                        <th className="text-center py-3 px-3 font-medium">Opening</th>
                        <th className="text-center py-3 px-3 font-medium text-blue-600">Closing</th>
                        <th className="text-center py-3 px-3 font-medium text-primary">Sold</th>
                        <th className="text-right py-3 px-4 font-medium text-primary">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.productRows.map((row) => (
                        <tr key={row.productId} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{row.productName}</td>
                          <td className="py-3 px-3 text-center text-amber-600">{row.leftover || "—"}</td>
                          <td className="py-3 px-3 text-center text-green-600">{row.newBatch || "—"}</td>
                          <td className="py-3 px-3 text-center font-semibold">{row.opening || "—"}</td>
                          <td className="py-3 px-3 text-center text-blue-600">{row.closing || "—"}</td>
                          <td className="py-3 px-3 text-center font-bold text-primary">{row.sold || "—"}</td>
                          <td className="py-3 px-4 text-right font-medium">{row.revenue > 0 ? fmt(row.revenue) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td className="py-3 px-4 font-bold" colSpan={5}>Total</td>
                        <td className="py-3 px-3 text-center font-bold text-primary">{data.totalUnitsSold}</td>
                        <td className="py-3 px-4 text-right font-bold text-primary">{fmt(data.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales detail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Sales Detail — Who Sold, When, How Much
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.sales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sales recorded for this date</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Receipt</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sold By</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground hidden sm:table-cell">Payment</th>
                        <th className="text-center py-3 px-3 font-medium text-muted-foreground hidden md:table-cell">Items</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((sale) => (
                        <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 text-muted-foreground text-xs">{fmtTime(sale.soldAt)}</td>
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{sale.receiptNumber}</td>
                          <td className="py-3 px-4 font-medium">{sale.soldBy}</td>
                          <td className="py-3 px-3 hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">{PAY_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</Badge>
                          </td>
                          <td className="py-3 px-3 text-center hidden md:table-cell text-muted-foreground">{sale.itemCount}</td>
                          <td className="py-3 px-4 text-right font-bold text-primary">{fmt(sale.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td className="py-3 px-4 font-bold" colSpan={5}>Total Revenue</td>
                        <td className="py-3 px-4 text-right font-bold text-primary">{fmt(data.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
