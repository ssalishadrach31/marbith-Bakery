import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Clearing all tables...");
    await client.query(`
      TRUNCATE TABLE messages, conversations, login_logs, notifications, pending_approvals,
        salary_payments, inventory_adjustments, shift_closings, shop_receipts, daily_counts,
        expenses, attendance, wholesale_supply_items, wholesale_supplies, wholesale_customers,
        deliveries, sale_items, sales, order_items, orders, production, inventory,
        products, users, employees, payments, shops CASCADE
    `);
    console.log("Tables cleared.");

    const empRes = await client.query(`
      INSERT INTO employees (name, role, phone, join_date, salary) VALUES
        ('Shadrach Ssali', 'admin', '0700000001', '2024-01-01', 2000000),
        ('Martha Namugga', 'admin', '0700000002', '2024-01-01', 2000000),
        ('Vivian Nakato', 'staff', '0700000003', '2024-02-01', 800000),
        ('Sharon Apio', 'cashier', '0700000004', '2024-02-01', 700000),
        ('Samuel Kato', 'baker', '0700000005', '2024-03-01', 750000),
        ('Kato Brian', 'baker', '0700000006', '2024-03-01', 750000),
        ('Rider One', 'rider', '0700000007', '2024-04-01', 500000)
      RETURNING id, name
    `);
    const emps = empRes.rows;
    console.log("Employees:", emps.map((e: any) => e.name).join(", "));

    const users = [
      { username: "shadrachssali@gmail.com", password: "admin123",    role: "admin",   name: "Shadrach Ssali", emp: emps[0].id },
      { username: "martha@marbithbakery.com", password: "password123", role: "admin",   name: "Martha Namugga", emp: emps[1].id },
      { username: "vivian@marbithbakery.com", password: "vivian123@",  role: "staff",   name: "Vivian Nakato",  emp: emps[2].id },
      { username: "sharon@marbithbakery.com", password: "@sharon123",  role: "cashier", name: "Sharon Apio",    emp: emps[3].id },
      { username: "samuel@marbithbakery.com", password: "123@samuel",  role: "baker",   name: "Samuel Kato",    emp: emps[4].id },
      { username: "kato@marbithbakery.com",   password: "kato123@",    role: "baker",   name: "Kato Brian",     emp: emps[5].id },
      { username: "rider1",                   password: "rider123",    role: "rider",   name: "Rider One",      emp: emps[6].id },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (username, password, role, name, employee_id) VALUES ($1, $2, $3, $4, $5)`,
        [u.username, hash, u.role, u.name, u.emp]
      );
    }
    console.log("Users:", users.map(u => u.username).join(", "));

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
      const res = await client.query(
        `INSERT INTO products (name, price, category, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
        [name, price, category]
      );
      await client.query(
        `INSERT INTO inventory (product_id, current_stock) VALUES ($1, 50)`,
        [res.rows[0].id]
      );
    }
    console.log("Products + inventory:", products.length, "items");
    console.log("\nNeon database is ready!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
