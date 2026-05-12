import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// ─── GET /api/reports/monthly?year=YYYY&month=MM ──────────────────────────────
router.get("/reports/monthly", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const now = new Date();
  const year  = parseInt(req.query.year  as string) || now.getFullYear();
  const month = parseInt(req.query.month as string) || (now.getMonth() + 1);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [posResult, countResult, receiptResult, closingResult, topProductsResult] = await Promise.all([
    db.execute(sql`
      SELECT DATE(sold_at)::text AS day,
             COALESCE(SUM(total_amount),0)::int AS pos_revenue,
             COUNT(*)::int AS pos_transactions
      FROM sales
      WHERE DATE(sold_at) BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY DATE(sold_at)
    `),
    db.execute(sql`
      SELECT dc_open.count_date::text AS day,
             COALESCE(SUM(GREATEST(0, dc_open.quantity - dc_close.quantity) * p.price),0)::int AS counted_revenue,
             COALESCE(SUM(GREATEST(0, dc_open.quantity - dc_close.quantity)),0)::int AS counted_units
      FROM daily_counts dc_open
      JOIN products p ON p.id = dc_open.product_id
      JOIN daily_counts dc_close
        ON dc_close.product_id = dc_open.product_id
       AND dc_close.count_type = 'closing'
       AND dc_close.count_date = dc_open.count_date
      WHERE dc_open.count_type = 'opening'
        AND dc_open.count_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY dc_open.count_date
    `),
    db.execute(sql`
      SELECT DATE(received_at)::text AS day,
             COALESCE(SUM(quantity_received),0)::int AS units_received
      FROM shop_receipts
      WHERE DATE(received_at) BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY DATE(received_at)
    `),
    db.execute(sql`
      SELECT shift_date::text AS day, closed_by, closed_at
      FROM shift_closings
      WHERE shift_date BETWEEN ${startDate}::date AND ${endDate}::date
    `).catch(() => ({ rows: [] })),
    db.execute(sql`
      SELECT p.name AS product_name, p.category,
             COALESCE(SUM(si.quantity),0)::int AS units_sold,
             COALESCE(SUM(si.quantity * si.unit_price),0)::int AS revenue
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.sold_at) BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY p.id, p.name, p.category
      ORDER BY revenue DESC
      LIMIT 20
    `),
  ]);

  const posMap: Record<string, any> = {};
  for (const r of posResult.rows) posMap[String((r as any).day)] = { posRevenue: Number((r as any).pos_revenue), posTransactions: Number((r as any).pos_transactions) };
  const countMap: Record<string, any> = {};
  for (const r of countResult.rows) countMap[String((r as any).day)] = { countedRevenue: Number((r as any).counted_revenue), countedUnits: Number((r as any).counted_units) };
  const receiptMap: Record<string, any> = {};
  for (const r of receiptResult.rows) receiptMap[String((r as any).day)] = { unitsReceived: Number((r as any).units_received) };
  const closingMap: Record<string, any> = {};
  for (const r of closingResult.rows) closingMap[String((r as any).day)] = { closedBy: (r as any).closed_by, closedAt: (r as any).closed_at };

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const day = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pos     = posMap[day]     || { posRevenue: 0, posTransactions: 0 };
    const count   = countMap[day]   || { countedRevenue: 0, countedUnits: 0 };
    const receipt = receiptMap[day] || { unitsReceived: 0 };
    const closing = closingMap[day] || null;
    days.push({ date: day, ...pos, ...count, ...receipt, closing, grandTotal: pos.posRevenue + count.countedRevenue });
  }

  const totals = days.reduce((acc, d) => ({
    posRevenue: acc.posRevenue + d.posRevenue,
    posTransactions: acc.posTransactions + d.posTransactions,
    countedRevenue: acc.countedRevenue + d.countedRevenue,
    countedUnits: acc.countedUnits + d.countedUnits,
    unitsReceived: acc.unitsReceived + d.unitsReceived,
    grandTotal: acc.grandTotal + d.grandTotal,
  }), { posRevenue: 0, posTransactions: 0, countedRevenue: 0, countedUnits: 0, unitsReceived: 0, grandTotal: 0 });

  res.json({ year, month, startDate, endDate, days, totals, topProducts: topProductsResult.rows });
});

// ─── GET /api/reports/shift-history?days=14 ──────────────────────────────────
router.get("/reports/shift-history", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const daysBack  = Math.min(parseInt(req.query.days as string) || 14, 60);
  const today     = new Date();
  const endDate   = today.toISOString().split("T")[0];
  const startDate = new Date(today.getTime() - daysBack * 86400000).toISOString().split("T")[0];

  const [posResult, countDetailResult, receiptResult, closingResult] = await Promise.all([
    db.execute(sql`
      SELECT DATE(sold_at)::text AS day,
             COALESCE(SUM(total_amount),0)::int AS pos_revenue,
             COUNT(*)::int AS pos_transactions
      FROM sales
      WHERE DATE(sold_at) BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY DATE(sold_at)
    `),
    db.execute(sql`
      SELECT dc_open.count_date::text AS day,
             p.name AS product_name,
             p.category,
             p.price::int,
             dc_open.quantity AS opening,
             dc_close.quantity AS closing,
             GREATEST(0, dc_open.quantity - dc_close.quantity) AS sold,
             GREATEST(0, dc_open.quantity - dc_close.quantity) * p.price AS revenue
      FROM daily_counts dc_open
      JOIN products p ON p.id = dc_open.product_id
      JOIN daily_counts dc_close
        ON dc_close.product_id = dc_open.product_id
       AND dc_close.count_type = 'closing'
       AND dc_close.count_date = dc_open.count_date
      WHERE dc_open.count_type = 'opening'
        AND dc_open.count_date BETWEEN ${startDate}::date AND ${endDate}::date
      ORDER BY dc_open.count_date DESC, p.name
    `),
    db.execute(sql`
      SELECT DATE(received_at)::text AS day,
             COALESCE(SUM(quantity_received),0)::int AS units_received,
             json_agg(json_build_object('productName', p.name, 'quantity', sr.quantity_received) ORDER BY p.name) AS items
      FROM shop_receipts sr
      JOIN products p ON p.id = sr.product_id
      WHERE DATE(received_at) BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY DATE(received_at)
    `),
    db.execute(sql`
      SELECT shift_date::text AS day, closed_by, closed_at
      FROM shift_closings
      WHERE shift_date BETWEEN ${startDate}::date AND ${endDate}::date
    `).catch(() => ({ rows: [] })),
  ]);

  const posMap: Record<string, any> = {};
  for (const r of posResult.rows) posMap[String((r as any).day)] = { posRevenue: Number((r as any).pos_revenue), posTransactions: Number((r as any).pos_transactions) };

  const countDetailMap: Record<string, any[]> = {};
  for (const r of countDetailResult.rows) {
    const day = String((r as any).day);
    if (!countDetailMap[day]) countDetailMap[day] = [];
    countDetailMap[day].push({ productName: (r as any).product_name, category: (r as any).category, price: Number((r as any).price), opening: Number((r as any).opening), closing: Number((r as any).closing), sold: Number((r as any).sold), revenue: Number((r as any).revenue) });
  }

  const receiptMap: Record<string, any> = {};
  for (const r of receiptResult.rows) receiptMap[String((r as any).day)] = { unitsReceived: Number((r as any).units_received), items: (r as any).items || [] };

  const closingMap: Record<string, any> = {};
  for (const r of closingResult.rows) closingMap[String((r as any).day)] = { closedBy: (r as any).closed_by, closedAt: (r as any).closed_at };

  const result = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day     = d.toISOString().split("T")[0];
    const pos     = posMap[day]          || { posRevenue: 0, posTransactions: 0 };
    const receipt = receiptMap[day]      || { unitsReceived: 0, items: [] };
    const closing = closingMap[day]      || null;
    const counts  = countDetailMap[day]  || [];
    const countedRevenue = counts.reduce((s, c) => s + c.revenue, 0);
    const grandTotal = pos.posRevenue + countedRevenue;
    if (grandTotal > 0 || receipt.unitsReceived > 0 || closing) {
      result.push({ date: day, ...pos, countedRevenue, countedUnits: counts.reduce((s, c) => s + c.sold, 0), ...receipt, closing, grandTotal, counts });
    }
  }

  res.json(result);
});

export default router;
