/**
 * Creates ALL tables in CockroachDB matching the Drizzle schemas exactly.
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 */
import pg from "pg";
const { Pool } = pg;

const url = process.env.COCKROACH_DATABASE_URL;
if (!url) throw new Error("COCKROACH_DATABASE_URL must be set");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const tables = [
  `CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    salary REAL,
    join_date TEXT NOT NULL,
    is_active BOOL NOT NULL DEFAULT true,
    shop_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    job_title TEXT,
    employee_id INT,
    is_active BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'piece',
    category TEXT,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    is_active BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    current_stock INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id)
  )`,

  `CREATE TABLE IF NOT EXISTS production (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'new_batch',
    produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by TEXT NOT NULL DEFAULT 'staff',
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    receipt_number TEXT NOT NULL UNIQUE,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    transaction_id TEXT,
    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sold_by TEXT NOT NULL DEFAULT 'staff'
  )`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS deliveries (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id),
    rider_id INT,
    status TEXT NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    fee REAL NOT NULL DEFAULT 0,
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS wholesale_customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    credit_limit REAL NOT NULL DEFAULT 0,
    outstanding_balance REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS wholesale_supplies (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES wholesale_customers(id),
    total_amount REAL NOT NULL,
    amount_paid REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    supplied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS wholesale_supply_items (
    id SERIAL PRIMARY KEY,
    supply_id INT NOT NULL REFERENCES wholesale_supplies(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'present',
    notes TEXT,
    UNIQUE (employee_id, date)
  )`,

  `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    network TEXT NOT NULL,
    amount REAL NOT NULL,
    phone_number TEXT NOT NULL,
    order_id INT REFERENCES orders(id),
    sale_id INT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS shop_receipts (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    quantity_received INT NOT NULL,
    received_by TEXT NOT NULL DEFAULT 'Staff',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS daily_counts (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    count_type TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by TEXT NOT NULL DEFAULT 'Staff',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    UNIQUE (product_id, count_type, count_date)
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount INT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    first_approved_by TEXT,
    first_approved_at TIMESTAMPTZ,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS pending_approvals (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    reference_id INT NOT NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOL NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS salary_payments (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    paid_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    is_active BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS shift_closings (
    id SERIAL PRIMARY KEY,
    closed_by TEXT NOT NULL,
    shift_date DATE NOT NULL UNIQUE,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by TEXT,
    approved_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL DEFAULT '',
    delta INT NOT NULL DEFAULT 0,
    new_stock INT NOT NULL DEFAULT 0,
    quantity INT NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT NOT NULL DEFAULT 'admin',
    adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id INT,
    username TEXT NOT NULL,
    success BOOL NOT NULL,
    ip_address TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    title TEXT,
    created_by INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INT,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

async function run() {
  console.log("Creating all tables in CockroachDB...\n");
  let created = 0;
  let skipped = 0;

  for (const ddl of tables) {
    const match = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    const name = match?.[1] ?? "unknown";
    try {
      await pool.query(ddl);
      console.log(`  ✓ ${name}`);
      created++;
    } catch (err: any) {
      console.error(`  ✗ ${name}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone — ${created} tables created/verified, ${skipped} errors`);

  // Show final table list
  const r = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("\nAll tables in DB:");
  r.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));

  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
