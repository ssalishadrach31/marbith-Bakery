import pg from "pg";

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error("NEON_DATABASE_URL not set");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log("Creating all tables...\n");

    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        join_date TEXT,
        salary INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        name TEXT NOT NULL,
        job_title TEXT,
        employee_id INTEGER REFERENCES employees(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'other',
        description TEXT,
        low_stock_threshold INTEGER NOT NULL DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        current_stock INTEGER NOT NULL DEFAULT 0,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS production (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        recorded_by TEXT NOT NULL,
        produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        receipt_number TEXT,
        total_amount INTEGER NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        sold_by TEXT NOT NULL,
        sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        subtotal INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        total_amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        subtotal INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        rider_id INTEGER REFERENCES employees(id),
        status TEXT NOT NULL DEFAULT 'assigned',
        delivery_fee INTEGER NOT NULL DEFAULT 0,
        picked_up_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wholesale_customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        contact_person TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wholesale_supplies (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES wholesale_customers(id),
        total_amount INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        supplied_by TEXT NOT NULL,
        supplied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS wholesale_supply_items (
        id SERIAL PRIMARY KEY,
        supply_id INTEGER NOT NULL REFERENCES wholesale_supplies(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        subtotal INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        date TEXT NOT NULL,
        check_in TIMESTAMPTZ,
        check_out TIMESTAMPTZ,
        hours_worked NUMERIC(5,2),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        amount INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'cash',
        reference TEXT,
        payment_type TEXT NOT NULL DEFAULT 'sale',
        related_id INTEGER,
        recorded_by TEXT NOT NULL,
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS shop_receipts (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity_received INTEGER NOT NULL,
        received_by TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS daily_counts (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        count_date TEXT NOT NULL,
        count_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        recorded_by TEXT NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        expense_date TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pending_approvals (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        submitted_by TEXT NOT NULL,
        submitted_by_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'system',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS salary_payments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        amount INTEGER NOT NULL,
        period TEXT NOT NULL,
        paid_by TEXT NOT NULL,
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
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

      CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        adjustment INTEGER NOT NULL,
        reason TEXT,
        adjusted_by TEXT NOT NULL,
        adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        role TEXT NOT NULL,
        ip_address TEXT,
        login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Conversation',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("All tables created.\n");

    // Clear existing data
    await client.query(`
      TRUNCATE TABLE messages, conversations, login_logs, notifications, pending_approvals,
        salary_payments, inventory_adjustments, shift_closings, shop_receipts, daily_counts,
        expenses, attendance, wholesale_supply_items, wholesale_supplies, wholesale_customers,
        deliveries, sale_items, sales, order_items, orders, production, inventory,
        products, users, employees, payments, shops CASCADE
    `);
    console.log("Cleared old data.\n");

    // Seed employees
    const empRes = await client.query(`
      INSERT INTO employees (name, role, phone, join_date, salary) VALUES
        ('Shadrach Ssali',  'admin',   '0700000001', '2024-01-01', 2000000),
        ('Martha Namugga',  'admin',   '0700000002', '2024-01-01', 2000000),
        ('Vivian Nakato',   'staff',   '0700000003', '2024-02-01', 800000),
        ('Sharon Apio',     'cashier', '0700000004', '2024-02-01', 700000),
        ('Samuel Kato',     'baker',   '0700000005', '2024-03-01', 750000),
        ('Kato Brian',      'baker',   '0700000006', '2024-03-01', 750000),
        ('Rider One',       'rider',   '0700000007', '2024-04-01', 500000)
      RETURNING id, name
    `);
    const emps = empRes.rows;
    console.log("Employees:", emps.map((e: any) => e.name).join(", "));

    // Seed users (plain text passwords — matches how auth.ts works)
    const users = [
      { username: "shadrachssali@gmail.com",  password: "admin123",    role: "admin",   name: "Shadrach Ssali", emp: emps[0].id },
      { username: "martha@marbithbakery.com", password: "password123", role: "admin",   name: "Martha Namugga", emp: emps[1].id },
      { username: "vivian@marbithbakery.com", password: "vivian123@",  role: "staff",   name: "Vivian Nakato",  emp: emps[2].id },
      { username: "sharon@marbithbakery.com", password: "@sharon123",  role: "cashier", name: "Sharon Apio",    emp: emps[3].id },
      { username: "samuel@marbithbakery.com", password: "123@samuel",  role: "baker",   name: "Samuel Kato",    emp: emps[4].id },
      { username: "kato@marbithbakery.com",   password: "kato123@",    role: "baker",   name: "Kato Brian",     emp: emps[5].id },
      { username: "rider1",                   password: "rider123",    role: "rider",   name: "Rider One",      emp: emps[6].id },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (username, password, role, name, employee_id) VALUES ($1,$2,$3,$4,$5)`,
        [u.username, u.password, u.role, u.name, u.emp]
      );
    }
    console.log("Users:", users.map(u => u.username).join(", "));

    // Seed products + inventory
    const products: [string, number, string][] = [
      ["Pizza", 5000, "food"],
      ["Rock Bun", 1500, "snack"],
      ["Cakes 6pcs", 2500, "cake"],
      ["Madeira Cake", 1000, "cake"],
      ["Vanilla Muffins", 2000, "cake"],
      ["Egg Rolls", 2000, "snack"],
      ["Sumbusa", 1000, "snack"],
      ["Chapattis", 1000, "food"],
      ["Mandazi 6pcs", 2500, "snack"],
      ["Plain Donuts", 1000, "snack"],
      ["Cookies", 1000, "snack"],
      ["Cinnamon Roll", 1000, "snack"],
      ["Teabites", 3000, "snack"],
      ["American Donuts", 2000, "snack"],
    ];

    for (const [name, price, category] of products) {
      const r = await client.query(
        `INSERT INTO products (name, price, category, is_active) VALUES ($1,$2,$3,true) RETURNING id`,
        [name, price, category]
      );
      await client.query(
        `INSERT INTO inventory (product_id, current_stock) VALUES ($1, 0)`,
        [r.rows[0].id]
      );
    }
    console.log("Products + inventory:", products.length, "items\n");
    console.log("Neon database is fully ready!");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
