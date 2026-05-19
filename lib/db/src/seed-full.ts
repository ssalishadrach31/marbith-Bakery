import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("Seeding full product catalog and staff into Neon...\n");

  // ── 1. FIX EXISTING BAKED GOODS CATEGORIES ────────────────────────────────
  const bakedGoods = [
    "Pizza", "Rock Bun", "Cakes 6pcs", "Madeira Cake", "Vanilla Muffins",
    "Egg Rolls", "Chapattis", "Mandazi 6pcs", "Plain Donuts", "Cookies",
    "Cinnamon Roll", "Teabites", "American Donuts",
  ];
  const snacks = ["Sumbusa"];

  for (const name of bakedGoods) {
    await client.query("UPDATE products SET category='baked_goods' WHERE name=$1", [name]);
  }
  for (const name of snacks) {
    await client.query("UPDATE products SET category='snacks' WHERE name=$1", [name]);
  }
  console.log("✓ Fixed baked goods categories");

  // ── 2. ADD MISSING PRODUCTS ────────────────────────────────────────────────
  const newProducts: { name: string; price: number; category: string; unit: string; threshold: number; initStock: number }[] = [
    // Ice Cream (counted daily)
    { name: "Ice Cream Big Cone",   price: 3000, category: "ice_cream", unit: "piece", threshold: 5,  initStock: 0 },
    { name: "Ice Cream Big Tin",    price: 2000, category: "ice_cream", unit: "tin",   threshold: 5,  initStock: 0 },
    { name: "Ice Cream Small Cone", price: 1000, category: "ice_cream", unit: "piece", threshold: 10, initStock: 0 },
    { name: "Ice Cream Small Tin",  price: 1000, category: "ice_cream", unit: "tin",   threshold: 10, initStock: 0 },
    // Juice (counted daily)
    { name: "Juice Big Tin",        price: 2000, category: "juice",     unit: "tin",   threshold: 5,  initStock: 0 },
    { name: "Juice Small Tin",      price: 1000, category: "juice",     unit: "tin",   threshold: 10, initStock: 0 },
    // Coffee (counted daily)
    { name: "Milk Coffee",          price: 2000, category: "coffee",    unit: "cup",   threshold: 5,  initStock: 0 },
    // Tea (counted daily)
    { name: "Black Tea",            price: 1000, category: "tea",       unit: "cup",   threshold: 5,  initStock: 0 },
    // Sodas & Energy Drinks (fridge stock)
    { name: "Bongo",                price: 2000, category: "drink",     unit: "bottle", threshold: 12, initStock: 0   },
    { name: "Coffee Malt",          price: 2500, category: "drink",     unit: "bottle", threshold: 12, initStock: 0   },
    { name: "Energy",               price: 3000, category: "drink",     unit: "can",    threshold: 12, initStock: 0   },
    { name: "Minute Maid",          price: 2000, category: "drink",     unit: "bottle", threshold: 12, initStock: 24  },
    { name: "Minute Maid Big",      price: 3500, category: "drink",     unit: "bottle", threshold: 6,  initStock: 0   },
    { name: "Nkoge",                price: 1500, category: "drink",     unit: "bottle", threshold: 12, initStock: 0   },
    { name: "Onner",                price: 2000, category: "drink",     unit: "bottle", threshold: 12, initStock: 123 },
    { name: "Predator",             price: 3000, category: "drink",     unit: "can",    threshold: 12, initStock: 12  },
    { name: "Rockboom",             price: 2500, category: "drink",     unit: "can",    threshold: 12, initStock: 24  },
    { name: "Soda 330ml",           price: 1500, category: "drink",     unit: "bottle", threshold: 24, initStock: 770 },
    { name: "Soda 500ml",           price: 2000, category: "drink",     unit: "bottle", threshold: 24, initStock: 36  },
    { name: "Sting",                price: 2500, category: "drink",     unit: "can",    threshold: 12, initStock: 24  },
    { name: "Tamarind",             price: 2000, category: "drink",     unit: "bottle", threshold: 12, initStock: 0   },
    // Milk & Dairy
    { name: "Fresh Dairy Tin",      price: 5000, category: "milk",      unit: "tin",    threshold: 6,  initStock: 6   },
    { name: "Jesa Milk",            price: 3500, category: "milk",      unit: "litre",  threshold: 12, initStock: 72  },
    { name: "Jesa Milk Flavored",   price: 4000, category: "milk",      unit: "bottle", threshold: 12, initStock: 24  },
    { name: "Jesa Sachet",          price: 1500, category: "milk",      unit: "sachet", threshold: 24, initStock: 70  },
    { name: "Probiotic Tin",        price: 6000, category: "milk",      unit: "tin",    threshold: 6,  initStock: 17  },
  ];

  let added = 0;
  for (const p of newProducts) {
    // Check if product already exists
    const exists = await client.query("SELECT id FROM products WHERE name=$1", [p.name]);
    if (exists.rows.length > 0) {
      const pid = exists.rows[0].id;
      // Update category/price to be correct
      await client.query(
        "UPDATE products SET price=$1, category=$2, is_active=true WHERE id=$3",
        [p.price, p.category, pid]
      );
      // Ensure inventory row exists
      const inv = await client.query("SELECT id FROM inventory WHERE product_id=$1", [pid]);
      if (inv.rows.length === 0) {
        await client.query("INSERT INTO inventory (product_id, current_stock) VALUES ($1, $2)", [pid, p.initStock]);
      }
      console.log(`  Updated: ${p.name} (${p.category})`);
    } else {
      const r = await client.query(
        "INSERT INTO products (name, price, category, unit, low_stock_threshold, is_active) VALUES ($1,$2,$3,$4,$5,true) RETURNING id",
        [p.name, p.price, p.category, p.unit, p.threshold]
      );
      const pid = r.rows[0].id;
      await client.query("INSERT INTO inventory (product_id, current_stock) VALUES ($1, $2)", [pid, p.initStock]);
      console.log(`  Added: ${p.name} (${p.category}) — stock: ${p.initStock}`);
      added++;
    }
  }
  console.log(`\n✓ ${added} new products added\n`);

  // ── 3. ADD MISSING EMPLOYEES & USERS ──────────────────────────────────────
  const missingStaff = [
    { name: "Asuman Kato",       role: "baker",  phone: "0700000008", salary: 750000, username: "asuman@marbithbakery.com",     password: "asuman123"   },
    { name: "Rubangakene Samuel",role: "baker",  phone: "0700000009", salary: 750000, username: "rubangakene@marbithbakery.com", password: "samuel123"   },
  ];

  for (const s of missingStaff) {
    const empExists = await client.query("SELECT id FROM employees WHERE name=$1", [s.name]);
    let empId: number;
    if (empExists.rows.length > 0) {
      empId = empExists.rows[0].id;
      console.log(`  Employee exists: ${s.name}`);
    } else {
      const er = await client.query(
        "INSERT INTO employees (name, role, phone, salary, join_date, is_active) VALUES ($1,$2,$3,$4,CURRENT_DATE,true) RETURNING id",
        [s.name, s.role, s.phone, s.salary]
      );
      empId = er.rows[0].id;
      console.log(`  Added employee: ${s.name} (${s.role}) id=${empId}`);
    }

    const userExists = await client.query("SELECT id FROM users WHERE username=$1", [s.username]);
    if (userExists.rows.length === 0) {
      await client.query(
        "INSERT INTO users (username, name, password, role, employee_id, is_active) VALUES ($1,$2,$3,$4,$5,true)",
        [s.username, s.name, s.password, s.role, empId]
      );
      console.log(`  Added user: ${s.username} / ${s.password}`);
    } else {
      console.log(`  User exists: ${s.username}`);
    }
  }

  // ── 4. FINAL SUMMARY ──────────────────────────────────────────────────────
  console.log("\n── Final product count by category ──");
  const cats = await client.query(
    "SELECT category, COUNT(*) as cnt FROM products WHERE is_active=true GROUP BY category ORDER BY category"
  );
  for (const r of cats.rows) console.log(`  ${r.category.padEnd(15)} ${r.cnt} products`);

  console.log("\n── Final employees ──");
  const emps = await client.query("SELECT name, role FROM employees ORDER BY role, name");
  for (const r of emps.rows) console.log(`  ${r.role.padEnd(12)} ${r.name}`);

  console.log("\n✓ Full seed complete!");
  await client.end();
}

run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
