import pg from "pg";

const COCKROACH_URL = process.env.COCKROACH_URL!;
const NEON_URL = process.env.NEON_DATABASE_URL!;

if (!COCKROACH_URL) { console.error("Missing COCKROACH_URL"); process.exit(1); }
if (!NEON_URL) { console.error("Missing NEON_DATABASE_URL"); process.exit(1); }

const src = new pg.Pool({ connectionString: COCKROACH_URL });
const tgt = new pg.Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

const TABLES = [
  "employees",
  "users",
  "products",
  "inventory",
  "shops",
  "wholesale_customers",
  "orders",
  "order_items",
  "deliveries",
  "wholesale_supplies",
  "wholesale_supply_items",
  "production",
  "sales",
  "sale_items",
  "shop_receipts",
  "daily_counts",
  "expenses",
  "attendance",
  "payments",
  "salary_payments",
  "shift_closings",
  "inventory_adjustments",
  "pending_approvals",
  "notifications",
  "login_logs",
  "conversations",
  "messages",
];

async function migrate() {
  const s = await src.connect();
  const t = await tgt.connect();

  try {
    // 1. Find which tables actually exist in CockroachDB
    const existsRes = await s.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const crdbTables = new Set(existsRes.rows.map((r: any) => r.table_name));
    console.log(`CockroachDB has ${crdbTables.size} tables:`, [...crdbTables].join(", "), "\n");

    // 2. Clear Neon tables in reverse dependency order
    console.log("Clearing Neon tables...");
    await t.query(`
      TRUNCATE TABLE
        messages, conversations, login_logs, notifications, pending_approvals,
        salary_payments, inventory_adjustments, shift_closings, shop_receipts,
        daily_counts, expenses, attendance, wholesale_supply_items,
        wholesale_supplies, wholesale_customers, deliveries, sale_items, sales,
        order_items, orders, production, inventory, products, users, employees,
        payments, shops
      CASCADE
    `);
    console.log("Neon cleared.\n");

    // 3. Migrate each table
    let totalRows = 0;
    for (const table of TABLES) {
      if (!crdbTables.has(table)) {
        console.log(`  ${table.padEnd(30)} (not in CockroachDB, skipped)`);
        continue;
      }

      const result = await s.query(`SELECT * FROM "${table}"`);
      const rows = result.rows;

      if (rows.length === 0) {
        console.log(`  ${table.padEnd(30)}     0 rows`);
        continue;
      }

      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");

      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map((c) => row[c]);
        await t.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${vals}) ON CONFLICT (id) DO UPDATE SET ${cols.filter(c => c !== 'id').map((c, i) => `"${c}" = EXCLUDED."${c}"`).join(", ")}`,
          values
        );
        inserted++;
      }

      // Reset sequence so new inserts don't collide
      await t
        .query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
        )
        .catch(() => {});

      console.log(`  ${table.padEnd(30)} ${String(inserted).padStart(5)} rows  ✓`);
      totalRows += inserted;
    }

    console.log(`\n✓ Migration complete — ${totalRows} total rows written to Neon.`);
  } finally {
    s.release();
    t.release();
    await src.end();
    await tgt.end();
  }
}

migrate().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
