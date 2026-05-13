import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, salesTable, saleItemsTable, productsTable, inventoryTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { CreateSaleBody, GetSaleParams, ListSalesQueryParams, GetDailySalesSummaryQueryParams } from "@workspace/api-zod";
import { notifyByRoles } from "../lib/notify";

const JWT_SECRET = process.env.SESSION_SECRET || "bakery-secret-key";
function getUserName(req: any): string {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return "Staff";
  try { const p = jwt.verify(h.slice(7), JWT_SECRET) as any; return p.name || "Staff"; } catch { return "Staff"; }
}

const router: IRouter = Router();

function generateReceipt() {
  return `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

class InsufficientStockError extends Error {
  readonly productName: string;
  readonly available: number;
  readonly requested: number;
  constructor(productName: string, available: number, requested: number) {
    super(`Not enough stock for "${productName}". Available: ${available}, requested: ${requested}`);
    this.productName = productName;
    this.available = available;
    this.requested = requested;
  }
}

router.get("/sales", async (req, res): Promise<void> => {
  const queryParams = ListSalesQueryParams.safeParse(req.query);
  let rows;
  if (queryParams.success && queryParams.data.date) {
    rows = await db
      .select({
        id: salesTable.id,
        receiptNumber: salesTable.receiptNumber,
        totalAmount: salesTable.totalAmount,
        paymentMethod: salesTable.paymentMethod,
        transactionId: salesTable.transactionId,
        soldAt: salesTable.soldAt,
        soldBy: salesTable.soldBy,
        itemCount: sql<number>`COUNT(${saleItemsTable.id})::int`,
      })
      .from(salesTable)
      .leftJoin(saleItemsTable, eq(salesTable.id, saleItemsTable.saleId))
      .where(sql`DATE(${salesTable.soldAt}) = ${queryParams.data.date}`)
      .groupBy(salesTable.id)
      .orderBy(salesTable.soldAt);
  } else {
    rows = await db
      .select({
        id: salesTable.id,
        receiptNumber: salesTable.receiptNumber,
        totalAmount: salesTable.totalAmount,
        paymentMethod: salesTable.paymentMethod,
        transactionId: salesTable.transactionId,
        soldAt: salesTable.soldAt,
        soldBy: salesTable.soldBy,
        itemCount: sql<number>`COUNT(${saleItemsTable.id})::int`,
      })
      .from(salesTable)
      .leftJoin(saleItemsTable, eq(salesTable.id, saleItemsTable.saleId))
      .groupBy(salesTable.id)
      .orderBy(salesTable.soldAt);
  }
  res.json(rows.map((r) => ({ ...r, itemCount: r.itemCount ?? 0 })));
});

router.get("/sales/daily-summary", async (req, res): Promise<void> => {
  const qp = GetDailySalesSummaryQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date as string : new Date().toISOString().split("T")[0];

  const rows = await db.select({
    paymentMethod: salesTable.paymentMethod,
    total: sql<number>`SUM(${salesTable.totalAmount})`,
    count: sql<number>`COUNT(*)::int`,
  }).from(salesTable).where(sql`DATE(${salesTable.soldAt}) = ${date}`).groupBy(salesTable.paymentMethod);

  const cash = rows.find((r) => r.paymentMethod === "cash")?.total ?? 0;
  const mtn = rows.find((r) => r.paymentMethod === "mtn_momo")?.total ?? 0;
  const airtel = rows.find((r) => r.paymentMethod === "airtel_money")?.total ?? 0;
  const totalTx = rows.reduce((a, r) => a + (r.count ?? 0), 0);

  res.json({ date, totalRevenue: cash + mtn + airtel, totalTransactions: totalTx, cashTotal: cash, mtnMomoTotal: mtn, airtelMoneyTotal: airtel });
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSaleParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const items = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      subtotal: saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, params.data.id));

  res.json({ ...sale, items: items.map((i) => ({ ...i, productName: i.productName ?? "Unknown" })) });
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paymentMethod, transactionId, items } = parsed.data;
  const sellerName = getUserName(req);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load all products needed
      const productIds = items.map((i) => i.productId);
      const products = await tx.select().from(productsTable).where(inArray(productsTable.id, productIds));
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 2. For each item: atomically deduct stock only if enough exists.
      //    The WHERE clause (current_stock >= requested_qty) makes this race-safe.
      //    If two cashiers sell the last unit simultaneously, only one transaction wins.
      for (const item of items) {
        const [updated] = await tx
          .update(inventoryTable)
          .set({
            currentStock: sql`${inventoryTable.currentStock} - ${item.quantity}`,
            lastUpdated: new Date(),
          })
          .where(
            and(
              eq(inventoryTable.productId, item.productId),
              sql`${inventoryTable.currentStock} >= ${item.quantity}`,
            ),
          )
          .returning({ newStock: inventoryTable.currentStock });

        if (!updated) {
          // Stock check failed — find out how much is actually available
          const [inv] = await tx.select({ currentStock: inventoryTable.currentStock })
            .from(inventoryTable)
            .where(eq(inventoryTable.productId, item.productId));
          const productName = productMap.get(item.productId)?.name ?? `Product #${item.productId}`;
          throw new InsufficientStockError(productName, inv?.currentStock ?? 0, item.quantity);
        }
      }

      // 3. Calculate totals
      let totalAmount = 0;
      const saleItems = items.map((item) => {
        const product = productMap.get(item.productId);
        const unitPrice = product?.price ?? 0;
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;
        return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal };
      });

      // 4. Record the sale
      const [sale] = await tx.insert(salesTable).values({
        receiptNumber: generateReceipt(),
        totalAmount,
        paymentMethod,
        transactionId: transactionId ?? null,
        soldBy: sellerName,
      }).returning();

      // 5. Record sale line items
      for (const item of saleItems) {
        await tx.insert(saleItemsTable).values({ saleId: sale.id, ...item });
      }

      return { sale, saleItems, totalAmount };
    });

    // Notify admins (outside transaction — fire-and-forget)
    const itemSummary = result.saleItems.length === 1
      ? `${result.saleItems[0].quantity} item`
      : `${result.saleItems.length} products`;
    notifyByRoles(["admin"], {
      type: "sale",
      title: "New Sale Completed",
      message: `${sellerName} sold ${itemSummary} · UGX ${result.totalAmount.toLocaleString()} via ${paymentMethod.replace("_", " ")}`,
      relatedId: result.sale.id,
    });

    res.status(201).json({ ...result.sale, itemCount: result.saleItems.length });

  } catch (err: unknown) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({
        error: err.message,
        code: "INSUFFICIENT_STOCK",
        productName: err.productName,
        available: err.available,
        requested: err.requested,
      });
    } else {
      throw err;
    }
  }
});

export default router;
