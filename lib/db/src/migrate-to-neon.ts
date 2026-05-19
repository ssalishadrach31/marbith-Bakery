import pg from "pg";

const source = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const target = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Tables in order that respects foreign key dependencies
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
  const src = await source.connect();
  const tgt = await target.connect();

  try {
    console.log("Starting migration: Replit → Neon\n");

    // Step 1: Clear Neon tables in reverse order
    console.log("Clearing Neon tables...");
    await tgt.query(`
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

    // Step 2: Copy each table
    let totalRows = 0;
    for (const table of TABLES) {
      // Check if table exists in source
      const exists = await src.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
        [table]
      );
      if (!exists.rows[0].exists) {
        console.log(`  ${table.padEnd(30)} (skipped — not in source)`);
        continue;
      }

      const result = await src.query(`SELECT * FROM "${table}" ORDER BY id`);
      const rows = result.rows;

      if (rows.length === 0) {
        console.log(`  ${table.padEnd(30)}     0 rows`);
        continue;
      }

      // Build INSERT with all columns
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(", ");

      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map(c => row[c]);
        await tgt.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING`,
          values
        );
        inserted++;
      }

      // Reset sequence so future inserts don't conflict
      await tgt.query(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
      ).catch(() => {});

      console.log(`  ${table.padEnd(30)} ${String(inserted).padStart(5)} rows  ✓`);
      totalRows += inserted;
    }

    console.log(`\nMigration complete! ${totalRows} total rows moved to Neon.`);

  } finally {
    src.release();
    tgt.release();
    await source.end();
    await target.end();
  }
}

migrate().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
