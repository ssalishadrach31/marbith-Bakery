import pg from "pg";

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.COCKROACH_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const tables = [
      "messages", "conversations", "shift_closings", "daily_counts", "shop_receipts",
      "inventory_adjustments", "pending_approvals", "notifications", "salary_payments",
      "attendance", "wholesale_supply_items", "wholesale_supplies", "wholesale_customers",
      "expenses", "deliveries", "sale_items", "sales", "production", "inventory", "products",
    ];
    for (const t of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${t}`);
        console.log("dropped", t);
      } catch (e: any) {
        console.log("skip", t, e.message.slice(0, 80));
      }
    }
    console.log("Tables dropped.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
