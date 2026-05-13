import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken, formatUGX } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, TrendingUp, ShoppingCart, Package, CheckCircle2 } from "lucide-react";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.json();
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtDate(d: string) {
  const date = new Date(d + "T12:00:00");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

export default function MonthlyReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-report", year, month],
    queryFn: () => apiFetch(`/reports/monthly?year=${year}&month=${month}`),
  });

  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const activeDays = (data?.days ?? []).filter((d: any) => d.grandTotal > 0 || d.unitsReceived > 0);

  return (
    <div>
      <style>{`
        @media print {
          aside, header, nav, .no-print, button { display: none !important; }
          .print-break { page-break-before: always; }
          body { font-size: 11px; color: #000; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; }
          .print-header { display: block !important; text-align: center; margin-bottom: 16px; }
        }
        .print-header { display: none; }
      `}</style>

      {/* Page header (screen only) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Monthly Statement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Admin-only — download as PDF for your records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
          >
            {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => window.print()} className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-header">
        <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>Marbith Bakery &amp; Investments</h1>
        <p style={{ fontSize: "14px" }}>Monthly Sales Statement — {monthLabel}</p>
        <p style={{ fontSize: "11px", color: "#666" }}>Generated: {new Date().toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}</p>
        <hr style={{ margin: "8px 0" }} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? (
        <p className="text-muted-foreground text-center py-12">No data available</p>
      ) : (
        <div className="space-y-6">
          {/* Summary cards (screen only) */}
          <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" /> Grand Total</div>
                <div className="text-xl font-bold text-primary">{formatUGX(data.totals.grandTotal)}</div>
                <div className="text-xs text-muted-foreground">{monthLabel}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><ShoppingCart className="h-3.5 w-3.5" /> POS Sales</div>
                <div className="text-xl font-bold">{formatUGX(data.totals.posRevenue)}</div>
                <div className="text-xs text-muted-foreground">{data.totals.posTransactions} transactions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Package className="h-3.5 w-3.5" /> Counted Sales</div>
                <div className="text-xl font-bold">{formatUGX(data.totals.countedRevenue)}</div>
                <div className="text-xs text-muted-foreground">{data.totals.countedUnits} units</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Active Days</div>
                <div className="text-xl font-bold">{activeDays.length}</div>
                <div className="text-xs text-muted-foreground">days with sales</div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly summary table (printed too) */}
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Daily Breakdown — {monthLabel}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Day</th>
                      <th className="text-right py-2.5 px-3 font-medium text-purple-600">POS Sales</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden sm:table-cell">Txns</th>
                      <th className="text-right py-2.5 px-3 font-medium text-cyan-600">Counted</th>
                      <th className="text-right py-2.5 px-3 font-medium text-blue-600 hidden md:table-cell">Received</th>
                      <th className="text-right py-2.5 px-4 font-medium text-primary">Grand Total</th>
                      <th className="text-center py-2.5 px-3 font-medium text-green-600 hidden sm:table-cell">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((day: any) => {
                      const hasActivity = day.grandTotal > 0 || day.unitsReceived > 0;
                      if (!hasActivity) return null;
                      return (
                        <tr key={day.date} className="border-t border-border hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">
                            {fmtDate(day.date)}
                            <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
                              {day.date.slice(5).replace("-", "/")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">{day.posRevenue > 0 ? formatUGX(day.posRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">{day.posTransactions > 0 ? day.posTransactions : "—"}</td>
                          <td className="py-2.5 px-3 text-right">{day.countedRevenue > 0 ? formatUGX(day.countedRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 text-right text-blue-700 hidden md:table-cell">{day.unitsReceived > 0 ? `${day.unitsReceived} u` : "—"}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-primary">{day.grandTotal > 0 ? formatUGX(day.grandTotal) : <span className="font-normal text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                            {day.closing ? (
                              <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {day.closing.closedBy}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-bold">
                      <td className="py-3 px-4">Month Total</td>
                      <td className="py-3 px-3 text-right text-purple-700">{formatUGX(data.totals.posRevenue)}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground hidden sm:table-cell">{data.totals.posTransactions}</td>
                      <td className="py-3 px-3 text-right text-cyan-700">{formatUGX(data.totals.countedRevenue)}</td>
                      <td className="py-3 px-3 text-right hidden md:table-cell">{data.totals.unitsReceived} u</td>
                      <td className="py-3 px-4 text-right text-primary text-lg">{formatUGX(data.totals.grandTotal)}</td>
                      <td className="hidden sm:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top products breakdown */}
          {data.topProducts.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Top Products — {monthLabel} (POS Sales)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Product</th>
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Units Sold</th>
                        <th className="text-right py-2.5 px-4 font-medium text-primary">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p: any, i: number) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">{p.product_name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell capitalize">{String(p.category).replace(/_/g, " ")}</td>
                          <td className="py-2.5 px-3 text-right">{p.units_sold}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-primary">{formatUGX(Number(p.revenue))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-bold">
                        <td className="py-3 px-4" colSpan={2}>Total (POS)</td>
                        <td className="py-3 px-3 text-right">{data.topProducts.reduce((s: number, p: any) => s + Number(p.units_sold), 0)}</td>
                        <td className="py-3 px-4 text-right text-primary">{formatUGX(data.topProducts.reduce((s: number, p: any) => s + Number(p.revenue), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Print footer */}
          <div className="print-header" style={{ marginTop: "24px", borderTop: "1px solid #ccc", paddingTop: "8px", fontSize: "10px", color: "#999" }}>
            Marbith Bakery &amp; Investments — Confidential — {monthLabel} Monthly Statement
          </div>
        </div>
      )}
    </div>
  );
}
