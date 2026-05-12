import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, dailyCountsTable, productsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";

function getUser(req: any): { userId: number; role: string; name: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET) as any; } catch { return null; }
}

// GET /api/daily-counts?date=YYYY-MM-DD&category=ice_cream|juice
router.get("/daily-counts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const category = req.query.category as string | undefined;

  const rows = await db
    .select({
      id: dailyCountsTable.id,
      productId: dailyCountsTable.productId,
      productName: productsTable.name,
      price: productsTable.price,
      category: productsTable.category,
      countType: dailyCountsTable.countType,
      quantity: dailyCountsTable.quantity,
      countDate: dailyCountsTable.countDate,
      recordedBy: dailyCountsTable.recordedBy,
      recordedAt: dailyCountsTable.recordedAt,
      notes: dailyCountsTable.notes,
    })
    .from(dailyCountsTable)
    .leftJoin(productsTable, eq(dailyCountsTable.productId, productsTable.id))
    .where(
      category
        ? and(eq(dailyCountsTable.countDate, date), eq(productsTable.category, category as any))
        : eq(dailyCountsTable.countDate, date)
    )
    .orderBy(productsTable.category, productsTable.name, dailyCountsTable.countType);

  res.json(rows.map((r) => ({ ...r, productName: r.productName ?? "Unknown", price: r.price ?? 0 })));
});

// POST /api/daily-counts — upsert opening or closing count
router.post("/daily-counts", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { productId, countType, quantity, countDate, notes } = req.body;

  if (!productId || !countType || !["opening", "closing"].includes(countType) || quantity === undefined) {
    res.status(400).json({ error: "productId, countType (opening|closing), and quantity are required" });
    return;
  }

  const today = countDate || new Date().toISOString().split("T")[0];

  // Upsert: update if exists for same product+type+date, otherwise insert
  const existing = await db
    .select()
    .from(dailyCountsTable)
    .where(
      and(
        eq(dailyCountsTable.productId, Number(productId)),
        eq(dailyCountsTable.countType, countType),
        eq(dailyCountsTable.countDate, today)
      )
    );

  let record;
  if (existing.length > 0) {
    [record] = await db
      .update(dailyCountsTable)
      .set({ quantity: Number(quantity), recordedBy: user.name || "Staff", recordedAt: new Date(), notes: notes || null })
      .where(eq(dailyCountsTable.id, existing[0].id))
      .returning();
  } else {
    [record] = await db.insert(dailyCountsTable).values({
      productId: Number(productId),
      countType,
      quantity: Number(quantity),
      countDate: today,
      recordedBy: user.name || "Staff",
      notes: notes || null,
    }).returning();
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, Number(productId)));
  res.status(201).json({ ...record, productName: product?.name ?? "Unknown", price: product?.price ?? 0 });
});

// POST /api/daily-counts/carry-forward — copy yesterday's closing counts as today's opening
router.post("/daily-counts/carry-forward", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { fromDate, toDate } = req.body;
  if (!fromDate || !toDate) { res.status(400).json({ error: "fromDate and toDate are required" }); return; }

  const closingRows = await db
    .select({ productId: dailyCountsTable.productId, quantity: dailyCountsTable.quantity })
    .from(dailyCountsTable)
    .where(and(eq(dailyCountsTable.countDate, fromDate), eq(dailyCountsTable.countType, "closing")));

  if (closingRows.length === 0) {
    res.json({ carried: 0, message: "No closing counts for that date" });
    return;
  }

  let carried = 0;
  for (const c of closingRows) {
    const existing = await db
      .select()
      .from(dailyCountsTable)
      .where(and(eq(dailyCountsTable.productId, c.productId), eq(dailyCountsTable.countType, "opening"), eq(dailyCountsTable.countDate, toDate)));

    if (existing.length > 0) {
      await db.update(dailyCountsTable)
        .set({ quantity: c.quantity, recordedBy: user.name, recordedAt: new Date() })
        .where(eq(dailyCountsTable.id, existing[0].id));
    } else {
      await db.insert(dailyCountsTable).values({
        productId: c.productId, countType: "opening", quantity: c.quantity,
        countDate: toDate, recordedBy: user.name,
      });
    }
    carried++;
  }

  res.json({ carried, message: `${carried} product${carried !== 1 ? "s" : ""} carried forward as today's opening stock` });
});

export default router;
