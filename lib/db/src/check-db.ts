import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const tables = [
      "users","employees","products","inventory","production",
      "sales","sale_items","orders","order_items","deliveries",
      "expenses","attendance","payments","shop_receipts","daily_counts",
      "shift_closings","wholesale_customers","wholesale_supplies",
      "notifications","pending_approvals","shops"
    ];
    console.log("Table row counts in database:\n");
    for (const t of tables) {
      try {
        const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
        const n = r.rows[0].n;
        const flag = n === 0 ? "  ← EMPTY" : "";
        console.log(`  ${t.padEnd(28)} ${String(n).padStart(5)}${flag}`);
      } catch {
        console.log(`  ${t.padEnd(28)}  (table missing)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();
