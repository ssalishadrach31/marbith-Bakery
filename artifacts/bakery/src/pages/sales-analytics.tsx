import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken, formatUGX } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, ShoppingCart, Package, Download, Printer,
  ChevronLeft, ChevronRight, Trophy, Star, AlertCircle,
  BarChart3, Calendar, CheckCircle2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); const err: any = new Error(e.error ?? "Request failed"); err.status = res.status; throw err; }
  return res.json();
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtDateLabel(d: string) {
  const date = new Date(d + "T12:00:00");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function SummaryCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-1`}>
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function TopProductsTable({ products, maxRevenue }: { products: any[]; maxRevenue: number }) {
  if (!products || products.length === 0) return (
    <p className="text-sm text-muted-foreground text-center py-6">No POS sales data for this period.</p>
  );
  return (
    <div className="space-y-2">
      {products.map((p: any, i: number) => {
        const rev = Number(p.revenue);
        const pct = maxRevenue > 0 ? (rev / maxRevenue) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3 group">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
              {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
            </div>
            <div className="w-32 shrink-0">
              <div className="text-sm font-medium truncate">{p.product_name}</div>
              <div className="text-xs text-muted-foreground capitalize">{String(p.category || "").replace(/_/g," ")}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{p.units_sold}u</span>
              </div>
            </div>
            <div className="text-sm font-semibold text-primary shrink-0 w-28 text-right">{formatUGX(rev)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DAILY TAB ────────────────────────────────────────────────────────────────

function DailyTab() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  function prevDay() { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate()-1); setDate(d.toISOString().split("T")[0]); }
  function nextDay() { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate()+1); if (d.toISOString().split("T")[0] <= today) setDate(d.toISOString().split("T")[0]); }

  const { data, isLoading } = useQuery({
    queryKey: ["daily-production-report", date],
    queryFn: () => apiFetch(`/production/daily-report?date=${date}`),
  });

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalUnits   = data?.totalUnitsSold ?? 0;
  const txns         = data?.sales?.length ?? 0;
  const avgSale      = txns > 0 ? Math.round(totalRevenue / txns) : 0;

  function handleDownload() {
    if (!data) return;
    const rows = (data.productRows ?? []).map((r: any) => [r.productName, r.opening ?? 0, r.closing ?? 0, r.sold ?? 0, r.revenue ?? 0]);
    downloadCSV(
      `daily-report-${date}.csv`,
      ["Product","Opening","Closing","Sold","Revenue (UGX)"],
      rows,
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevDay}><ChevronLeft className="h-4 w-4" /></Button>
          <input
            type="date" value={date} max={today}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <Button variant="outline" size="sm" onClick={nextDay} disabled={date >= today}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : !data ? (
        <div className="text-center py-16 text-muted-foreground"><AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-30" /><p>No data for {dateLabel}</p></div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground font-medium">{dateLabel}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={TrendingUp} label="Total Revenue" value={formatUGX(totalRevenue)} sub={dateLabel} />
            <SummaryCard icon={ShoppingCart} label="Transactions" value={txns} sub="Sales receipts" color="text-foreground" />
            <SummaryCard icon={Package} label="Units Sold" value={totalUnits} sub="Items sold" color="text-foreground" />
            <SummaryCard icon={TrendingUp} label="Avg Sale Value" value={formatUGX(avgSale)} sub="Per transaction" color="text-foreground" />
          </div>

          {data.productRows?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Product Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/40 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Product</th>
                      <th className="text-center py-2.5 px-3 font-medium text-amber-600">Opening</th>
                      <th className="text-center py-2.5 px-3 font-medium text-blue-600">Closing</th>
                      <th className="text-center py-2.5 px-3 font-medium text-primary">Sold</th>
                      <th className="text-right py-2.5 px-3 font-medium text-primary">Revenue</th>
                    </tr></thead>
                    <tbody>
                      {data.productRows.map((r: any) => (
                        <tr key={r.productId} className="border-t border-border hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{r.productName}</td>
                          <td className="py-2.5 px-3 text-center text-amber-600">{r.opening || "—"}</td>
                          <td className="py-2.5 px-3 text-center text-blue-600">{r.closing || "—"}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-primary">{r.sold || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-medium">{r.revenue > 0 ? formatUGX(r.revenue) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border bg-muted/40 font-bold">
                      <td className="py-2.5 px-3" colSpan={3}>Total</td>
                      <td className="py-2.5 px-3 text-center text-primary">{totalUnits}</td>
                      <td className="py-2.5 px-3 text-right text-primary">{formatUGX(totalRevenue)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── WEEKLY TAB ───────────────────────────────────────────────────────────────

function getThisMonday() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().split("T")[0];
}

function WeeklyTab() {
  const [startDate, setStartDate] = useState(getThisMonday);
  const today = new Date().toISOString().split("T")[0];

  function prevWeek() { const d = new Date(startDate + "T12:00:00"); d.setDate(d.getDate()-7); setStartDate(d.toISOString().split("T")[0]); }
  function nextWeek() { const d = new Date(startDate + "T12:00:00"); d.setDate(d.getDate()+7); if (d.toISOString().split("T")[0] <= today) setStartDate(d.toISOString().split("T")[0]); }

  const endDate = (() => { const d = new Date(startDate + "T12:00:00"); d.setDate(d.getDate()+6); return d.toISOString().split("T")[0]; })();

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-report", startDate],
    queryFn: () => apiFetch(`/reports/weekly?startDate=${startDate}`),
  });

  const weekLabel = `${fmtDateLabel(startDate)} – ${fmtDateLabel(endDate)}`;
  const maxDay = Math.max(...(data?.days ?? []).map((d: any) => d.grandTotal), 1);
  const maxProd = Math.max(...(data?.topProducts ?? []).map((p: any) => Number(p.revenue)), 1);

  const bestDay = data?.days?.reduce((best: any, d: any) => d.grandTotal > (best?.grandTotal ?? 0) ? d : best, null);

  function handleDownload() {
    if (!data) return;
    downloadCSV(
      `weekly-report-${startDate}.csv`,
      ["Date","Day","POS Revenue","Transactions","Counted Revenue","Grand Total (UGX)"],
      data.days.map((d: any) => [d.date, WEEKDAYS[new Date(d.date+"T12:00:00").getDay()], d.posRevenue, d.posTransactions, d.countedRevenue, d.grandTotal]),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-3 py-1.5 border border-border rounded-md bg-background min-w-[220px] text-center">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={nextWeek} disabled={endDate >= today}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : !data ? (
        <p className="text-center py-12 text-muted-foreground">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={TrendingUp} label="Week Total" value={formatUGX(data.totals.grandTotal)} sub={weekLabel} />
            <SummaryCard icon={ShoppingCart} label="Transactions" value={data.totals.posTransactions} sub="POS sales" color="text-foreground" />
            <SummaryCard icon={Package} label="Units Counted" value={data.totals.countedUnits} sub="Counted sold" color="text-foreground" />
            <SummaryCard icon={Trophy} label="Best Day" value={bestDay ? fmtDateLabel(bestDay.date).split(" ")[0] : "—"} sub={bestDay ? formatUGX(bestDay.grandTotal) : "No sales yet"} color="text-amber-600" />
          </div>

          {/* Day-by-day visual */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Day-by-Day — {weekLabel}</h3>
              <div className="space-y-2.5">
                {data.days.map((d: any) => {
                  const pct = (d.grandTotal / maxDay) * 100;
                  const dayName = WEEKDAYS[new Date(d.date+"T12:00:00").getDay()];
                  const isBest = d.date === bestDay?.date && d.grandTotal > 0;
                  return (
                    <div key={d.date} className={`p-3 rounded-lg border ${isBest ? "border-amber-200 bg-amber-50/40" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm w-8">{dayName}</span>
                          <span className="text-xs text-muted-foreground">{d.date.slice(5).replace("-","/")}</span>
                          {isBest && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Best day</span>}
                          {d.closing && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        <span className={`font-bold text-sm ${d.grandTotal > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {d.grandTotal > 0 ? formatUGX(d.grandTotal) : "No sales"}
                        </span>
                      </div>
                      {d.grandTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-20 text-right">{d.posTransactions} txn{d.posTransactions !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top products */}
          {data.topProducts?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top Products This Week</h3>
                <TopProductsTable products={data.topProducts} maxRevenue={maxProd} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── MONTHLY TAB ──────────────────────────────────────────────────────────────

function MonthlyTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); }
  function nextMonth() {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    if (ny < now.getFullYear() || (ny === now.getFullYear() && nm <= now.getMonth()+1)) { setMonth(nm); setYear(ny); }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-report", year, month],
    queryFn: () => apiFetch(`/reports/monthly?year=${year}&month=${month}`),
  });

  const monthLabel = `${MONTHS[month-1]} ${year}`;
  const activeDays = (data?.days ?? []).filter((d: any) => d.grandTotal > 0);
  const maxDay = Math.max(...(data?.days ?? []).map((d: any) => d.grandTotal), 1);
  const maxProd = Math.max(...(data?.topProducts ?? []).map((p: any) => Number(p.revenue)), 1);
  const bestDay = data?.days?.reduce((b: any, d: any) => d.grandTotal > (b?.grandTotal ?? 0) ? d : b, null);

  function handleDownload() {
    if (!data) return;
    downloadCSV(
      `monthly-report-${year}-${String(month).padStart(2,"0")}.csv`,
      ["Date","Day","POS Revenue","Transactions","Counted Revenue","Grand Total (UGX)","Closed By"],
      data.days.filter((d: any) => d.grandTotal > 0 || d.unitsReceived > 0).map((d: any) => [
        d.date,
        WEEKDAYS[new Date(d.date+"T12:00:00").getDay()],
        d.posRevenue, d.posTransactions,
        d.countedRevenue, d.grandTotal,
        d.closing?.closedBy ?? "",
      ]),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-1">
            <select value={month} onChange={e=>setMonth(+e.target.value)} className="border border-border rounded-md px-2 py-1.5 text-sm bg-background">
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(+e.target.value)} className="border border-border rounded-md px-2 py-1.5 text-sm bg-background">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : !data ? (
        <p className="text-center py-12 text-muted-foreground">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={TrendingUp} label="Month Total" value={formatUGX(data.totals.grandTotal)} sub={monthLabel} />
            <SummaryCard icon={ShoppingCart} label="Transactions" value={data.totals.posTransactions} sub="POS sales" color="text-foreground" />
            <SummaryCard icon={Calendar} label="Active Days" value={activeDays.length} sub="Days with sales" color="text-foreground" />
            <SummaryCard icon={Trophy} label="Best Day" value={bestDay?.grandTotal > 0 ? formatUGX(bestDay.grandTotal) : "—"} sub={bestDay?.grandTotal > 0 ? fmtDateLabel(bestDay.date) : "No sales yet"} color="text-amber-600" />
          </div>

          {/* Day breakdown table */}
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Day-by-Day Breakdown — {monthLabel}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 border-b border-border">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Day</th>
                    <th className="text-right py-2.5 px-3 font-medium text-purple-600">POS</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden sm:table-cell">Txns</th>
                    <th className="text-right py-2.5 px-3 font-medium text-cyan-600">Counted</th>
                    <th className="text-right py-2.5 px-4 font-medium text-primary">Total</th>
                    <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell" />
                    <th className="text-center py-2.5 px-3 font-medium text-green-600 hidden sm:table-cell">Closed</th>
                  </tr></thead>
                  <tbody>
                    {data.days.map((d: any) => {
                      if (d.grandTotal === 0 && !d.unitsReceived) return null;
                      const isBest = d.date === bestDay?.date && d.grandTotal > 0;
                      const pct = (d.grandTotal / maxDay) * 100;
                      return (
                        <tr key={d.date} className={`border-t border-border ${isBest ? "bg-amber-50/40" : "hover:bg-muted/20"}`}>
                          <td className="py-2.5 px-4 font-medium">
                            {WEEKDAYS[new Date(d.date+"T12:00:00").getDay()]} {d.date.slice(8)}
                            {isBest && <span className="ml-2 text-xs text-amber-600 font-medium">★ Best</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">{d.posRevenue > 0 ? formatUGX(d.posRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">{d.posTransactions || "—"}</td>
                          <td className="py-2.5 px-3 text-right">{d.countedRevenue > 0 ? formatUGX(d.countedRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-primary">{d.grandTotal > 0 ? formatUGX(d.grandTotal) : <span className="font-normal text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <div className="w-20 bg-muted rounded-full h-1.5"><div className="bg-primary rounded-full h-1.5" style={{ width: `${pct}%` }} /></div>
                          </td>
                          <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                            {d.closing ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-3 text-right text-purple-700">{formatUGX(data.totals.posRevenue)}</td>
                    <td className="py-3 px-3 text-right text-muted-foreground hidden sm:table-cell">{data.totals.posTransactions}</td>
                    <td className="py-3 px-3 text-right text-cyan-700">{formatUGX(data.totals.countedRevenue)}</td>
                    <td className="py-3 px-4 text-right text-primary text-base">{formatUGX(data.totals.grandTotal)}</td>
                    <td className="hidden md:table-cell" /><td className="hidden sm:table-cell" />
                  </tr></tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top products */}
          {data.topProducts?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top Products — {monthLabel}</h3>
                <TopProductsTable products={data.topProducts} maxRevenue={maxProd} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── YEARLY TAB ───────────────────────────────────────────────────────────────

function YearlyTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  const { data, isLoading } = useQuery({
    queryKey: ["yearly-report", year],
    queryFn: () => apiFetch(`/reports/yearly?year=${year}`),
  });

  const maxMonth = Math.max(...(data?.months ?? []).map((m: any) => m.grandTotal), 1);
  const maxProd  = Math.max(...(data?.topProducts ?? []).map((p: any) => Number(p.revenue)), 1);
  const maxQ     = Math.max(...(data?.quarters ?? []).map((q: any) => q.grandTotal), 1);

  const bestMonth = data?.months?.reduce((b: any, m: any) => m.grandTotal > (b?.grandTotal ?? 0) ? m : b, null);
  const bestQ     = data?.quarters?.reduce((b: any, q: any) => q.grandTotal > (b?.grandTotal ?? 0) ? q : b, null);
  const slowestQ  = data?.quarters?.filter((q: any) => q.grandTotal > 0).reduce((b: any, q: any) => q.grandTotal < (b?.grandTotal ?? Infinity) ? q : b, null);

  const prevDiff = data && data.prevYearTotal > 0
    ? ((data.totals.grandTotal - data.prevYearTotal) / data.prevYearTotal * 100).toFixed(1)
    : null;

  function handleDownload() {
    if (!data) return;
    downloadCSV(
      `yearly-report-${year}.csv`,
      ["Month","POS Revenue","Transactions","Counted Revenue","Grand Total (UGX)"],
      data.months.map((m: any) => [MONTHS[m.month-1], m.posRevenue, m.posTransactions, m.countedRevenue, m.grandTotal]),
    );
  }

  const Q_COLORS = ["bg-blue-500","bg-green-500","bg-amber-500","bg-purple-500"];
  const Q_BG    = ["bg-blue-50 border-blue-100","bg-green-50 border-green-100","bg-amber-50 border-amber-100","bg-purple-50 border-purple-100"];
  const Q_TEXT  = ["text-blue-700","text-green-700","text-amber-700","text-purple-700"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear(y=>y-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <select value={year} onChange={e=>setYear(+e.target.value)} className="border border-border rounded-md px-3 py-1.5 text-sm bg-background font-medium">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setYear(y=>y+1)} disabled={year >= now.getFullYear()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : !data ? (
        <p className="text-center py-12 text-muted-foreground">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={TrendingUp} label={`${year} Total Revenue`} value={formatUGX(data.totals.grandTotal)} sub={`Full year`} />
            <SummaryCard icon={ShoppingCart} label="Total Transactions" value={data.totals.posTransactions.toLocaleString()} sub="POS sales" color="text-foreground" />
            <SummaryCard icon={Trophy} label="Best Month" value={bestMonth?.grandTotal > 0 ? MONTHS_SHORT[bestMonth.month-1] : "—"} sub={bestMonth?.grandTotal > 0 ? formatUGX(bestMonth.grandTotal) : "No data"} color="text-amber-600" />
            <SummaryCard
              icon={TrendingUp}
              label="vs Last Year"
              value={prevDiff !== null ? `${prevDiff > "0" ? "+" : ""}${prevDiff}%` : "—"}
              sub={data.prevYearTotal > 0 ? `Last year: ${formatUGX(data.prevYearTotal)}` : "No prior year data"}
              color={prevDiff === null ? "text-muted-foreground" : Number(prevDiff) >= 0 ? "text-green-600" : "text-red-600"}
            />
          </div>

          {/* Seasonal analysis */}
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Seasonal Analysis — {year}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Use this to plan production, staffing, and promotions for each season.</p>
              <div className="space-y-4">
                {(data.quarters as any[]).map((q: any, i: number) => {
                  const pct = maxQ > 0 ? (q.grandTotal / maxQ) * 100 : 0;
                  const annualPct = data.totals.grandTotal > 0 ? (q.grandTotal / data.totals.grandTotal * 100).toFixed(1) : "0.0";
                  const isBest    = q.label === bestQ?.label && q.grandTotal > 0;
                  const isSlowest = q.label === slowestQ?.label && !isBest;
                  return (
                    <div key={q.label} className={`p-4 rounded-xl border ${Q_BG[i]}`}>
                      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${Q_TEXT[i]}`}>{q.label}</span>
                          {isBest && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">🏆 Peak Season</span>}
                          {isSlowest && <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">📣 Push Promotions</span>}
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${Q_TEXT[i]}`}>{formatUGX(q.grandTotal)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({annualPct}% of year)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white/60 rounded-full h-3">
                          <div className={`${Q_COLORS[i]} rounded-full h-3 transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{q.transactions} txns</span>
                      </div>
                      {isBest && (
                        <p className="text-xs text-amber-700 mt-2">
                          ↑ Your strongest season — increase stock, staff on standby, and plan special promotions here.
                        </p>
                      )}
                      {isSlowest && (
                        <p className="text-xs text-slate-600 mt-2">
                          ↓ Slowest season — consider discounts, bundle deals, or new product launches to drive traffic.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Month-by-month table */}
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Month-by-Month — {year}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 border-b border-border">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Month</th>
                    <th className="text-right py-2.5 px-3 font-medium text-purple-600">POS</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden sm:table-cell">Txns</th>
                    <th className="text-right py-2.5 px-3 font-medium text-cyan-600">Counted</th>
                    <th className="text-right py-2.5 px-4 font-medium text-primary">Total</th>
                    <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell" />
                  </tr></thead>
                  <tbody>
                    {data.months.map((m: any) => {
                      const pct = (m.grandTotal / maxMonth) * 100;
                      const isBest = m.month === bestMonth?.month && m.grandTotal > 0;
                      return (
                        <tr key={m.month} className={`border-t border-border ${isBest ? "bg-amber-50/40" : "hover:bg-muted/20"}`}>
                          <td className="py-2.5 px-4 font-medium">
                            {MONTHS[m.month-1]}
                            {isBest && <span className="ml-2 text-xs text-amber-600">★ Best</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">{m.posRevenue > 0 ? formatUGX(m.posRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">{m.posTransactions || "—"}</td>
                          <td className="py-2.5 px-3 text-right">{m.countedRevenue > 0 ? formatUGX(m.countedRevenue) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-primary">{m.grandTotal > 0 ? formatUGX(m.grandTotal) : <span className="font-normal text-muted-foreground">—</span>}</td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <div className="w-24 bg-muted rounded-full h-2"><div className="bg-primary rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="py-3 px-4">Year Total</td>
                    <td className="py-3 px-3 text-right text-purple-700">{formatUGX(data.totals.posRevenue)}</td>
                    <td className="py-3 px-3 text-right text-muted-foreground hidden sm:table-cell">{data.totals.posTransactions}</td>
                    <td className="py-3 px-3 text-right text-cyan-700">{formatUGX(data.totals.countedRevenue)}</td>
                    <td className="py-3 px-4 text-right text-primary text-base">{formatUGX(data.totals.grandTotal)}</td>
                    <td className="hidden md:table-cell" />
                  </tr></tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top products for the year */}
          {data.topProducts?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-1 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top Products — {year}</h3>
                <p className="text-xs text-muted-foreground mb-4">Best-performing products by revenue across the whole year.</p>
                <TopProductsTable products={data.topProducts} maxRevenue={maxProd} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SalesAnalyticsPage() {
  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          aside, header, nav, .no-print, button, [role="tablist"] { display: none !important; }
          body { font-size: 11px; color: #000; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; }
        }
      `}</style>

      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Sales Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Daily · Weekly · Monthly · Yearly — download as CSV or print to PDF</p>
        </div>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
          <TabsTrigger value="yearly" className="text-xs sm:text-sm">Yearly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"   className="mt-5"><DailyTab /></TabsContent>
        <TabsContent value="weekly"  className="mt-5"><WeeklyTab /></TabsContent>
        <TabsContent value="monthly" className="mt-5"><MonthlyTab /></TabsContent>
        <TabsContent value="yearly"  className="mt-5"><YearlyTab /></TabsContent>
      </Tabs>
    </div>
  );
}
