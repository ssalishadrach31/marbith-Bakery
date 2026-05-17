/**
 * Push CockroachDB schema using the runtime SSL pool (rejectUnauthorized: false).
 * Run with: pnpm --filter @workspace/db exec tsx src/push-cockroach.ts
 */
import pg from "pg";

const { Pool } = pg;

const url = process.env.COCKROACH_DATABASE_URL;
if (!url) throw new Error("COCKROACH_DATABASE_URL must be set");

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const DDL = `
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  category TEXT,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  is_active BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS production (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  notes TEXT,
  produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  cashier_id INT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL,
  rider_id INT,
  status TEXT NOT NULL DEFAULT 'assigned',
  pickup_time TIMESTAMPTZ,
  delivery_time TIMESTAMPTZ,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by INT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wholesale_customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wholesale_supplies (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES wholesale_customers(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  supplied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS wholesale_supply_items (
  id SERIAL PRIMARY KEY,
  supply_id INT NOT NULL REFERENCES wholesale_supplies(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours_worked NUMERIC(5,2),
  notes TEXT,
  UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  period TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_approvals (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_user_id INT NOT NULL,
  target_user_name TEXT NOT NULL,
  target_username TEXT NOT NULL,
  requested_by_id INT NOT NULL,
  requested_by_name TEXT NOT NULL,
  new_password TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  adjustment INT NOT NULL,
  reason TEXT,
  adjusted_by INT,
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_receipts (
  id SERIAL PRIMARY KEY,
  shift_date DATE NOT NULL,
  product_id INT NOT NULL REFERENCES products(id),
  opening_count INT NOT NULL DEFAULT 0,
  closing_count INT NOT NULL DEFAULT 0,
  sold_count INT NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_counts (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  count_type TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  counted_by INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_closings (
  id SERIAL PRIMARY KEY,
  closed_by TEXT NOT NULL,
  shift_date DATE NOT NULL UNIQUE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_by TEXT,
  approved_at TIMESTAMPTZ
);
`;

async function main() {
  const client = await pool.connect();
  try {
    const vRes = await client.query("SELECT version()");
    console.log("Connected:", vRes.rows[0].version.split(" ").slice(0, 3).join(" "));

    const statements = DDL.split(";").map((s) => s.trim()).filter(Boolean);
    let ok = 0;
    let skip = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        ok++;
      } catch (e: any) {
        if (e.message?.includes("already exists")) {
          skip++;
        } else {
          console.error("Failed:", stmt.slice(0, 80), "\n  →", e.message);
        }
      }
    }
    console.log(`Done — ${ok} statements executed, ${skip} already existed.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
