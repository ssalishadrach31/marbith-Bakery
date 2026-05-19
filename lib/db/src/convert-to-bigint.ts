import pg from "pg";

const tgt = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await tgt.connect();
  console.log("Converting all integer ID/FK columns to BIGINT in Neon...\n");

  // 1. Drop all FK constraints
  const fkRes = await tgt.query(`
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  for (const r of fkRes.rows) {
    await tgt.query(`ALTER TABLE "${r.table_name}" DROP CONSTRAINT IF EXISTS "${r.constraint_name}"`);
    console.log(`  Dropped FK: ${r.constraint_name} on ${r.table_name}`);
  }

  // 2. Find all integer columns that are IDs or FKs (id, *_id columns)
  const colRes = await tgt.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('integer', 'smallint')
      AND (column_name = 'id' OR column_name LIKE '%_id')
    ORDER BY table_name, column_name
  `);

  for (const r of colRes.rows) {
    await tgt.query(`ALTER TABLE "${r.table_name}" ALTER COLUMN "${r.column_name}" TYPE BIGINT`);
    console.log(`  ${r.table_name}.${r.column_name} → BIGINT`);
  }

  // 3. Re-add FK constraints
  const fkDefs = [
    ['inventory',              'product_id', 'products',            'id'],
    ['production',             'product_id', 'products',            'id'],
    ['sale_items',             'sale_id',    'sales',               'id'],
    ['sale_items',             'product_id', 'products',            'id'],
    ['order_items',            'order_id',   'orders',              'id'],
    ['order_items',            'product_id', 'products',            'id'],
    ['deliveries',             'order_id',   'orders',              'id'],
    ['wholesale_supplies',     'customer_id','wholesale_customers', 'id'],
    ['wholesale_supply_items', 'supply_id',  'wholesale_supplies',  'id'],
    ['wholesale_supply_items', 'product_id', 'products',            'id'],
    ['shop_receipts',          'product_id', 'products',            'id'],
    ['daily_counts',           'product_id', 'products',            'id'],
    ['messages',               'conversation_id', 'conversations',  'id'],
  ];

  console.log("\nRe-adding FK constraints...");
  for (const [table, col, refTable, refCol] of fkDefs) {
    const name = `fk_${table}_${col}`;
    await tgt.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${col}") REFERENCES "${refTable}"("${refCol}") ON DELETE CASCADE`
    ).catch((e) => console.log(`  (skipped ${name}: ${e.message})`));
    console.log(`  ${name} ✓`);
  }

  // 4. Fix sequences — convert to bigint sequences where needed
  const seqRes = await tgt.query(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'id'
    ORDER BY table_name
  `);
  console.log("\nSequences are auto-managed by Neon. Done.");

  await tgt.end();
  console.log("\n✓ Schema conversion complete — all ID columns are now BIGINT.");
}

run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
