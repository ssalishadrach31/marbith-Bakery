import { cockroachDb } from "./index";
import { usersTable, employeesTable, productsTable, inventoryTable } from "./schema";

async function seedFull() {
  console.log("Starting full CockroachDB seed...");

  // ── 1. Clear existing data ──────────────────────────────────────────────────
  console.log("Clearing existing data...");
  await cockroachDb.delete(usersTable);
  await cockroachDb.delete(inventoryTable);
  await cockroachDb.delete(productsTable);
  await cockroachDb.delete(employeesTable);
  console.log("Cleared.");

  // ── 2. Employees ────────────────────────────────────────────────────────────
  const [shadrachEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Shadrach Ssali",
    role: "admin",
    phone: "0700000001",
    email: "shadrachssali@gmail.com",
    salary: 2000000,
    joinDate: "2023-01-01",
    isActive: true,
  }).returning();

  const [marthaEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Martha Nakato",
    role: "admin",
    phone: "0700000002",
    email: "martha@marbithbakery.com",
    salary: 2000000,
    joinDate: "2023-01-01",
    isActive: true,
  }).returning();

  const [vivianEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Vivian Apio",
    role: "cashier",
    phone: "0700000003",
    email: "vivian@marbithbakery.com",
    salary: 700000,
    joinDate: "2023-03-01",
    isActive: true,
  }).returning();

  const [sharonEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Sharon Nambi",
    role: "cashier",
    phone: "0700000004",
    email: "sharon@marbithbakery.com",
    salary: 650000,
    joinDate: "2023-04-01",
    isActive: true,
  }).returning();

  const [samuelEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Samuel Kizza",
    role: "baker",
    phone: "0700000005",
    email: "samuel@marbithbakery.com",
    salary: 800000,
    joinDate: "2023-02-01",
    isActive: true,
  }).returning();

  const [katoEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Kato Ssemakula",
    role: "baker",
    phone: "0700000006",
    email: "kato@marbithbakery.com",
    salary: 750000,
    joinDate: "2023-02-15",
    isActive: true,
  }).returning();

  const [riderEmp] = await cockroachDb.insert(employeesTable).values({
    name: "Rider One",
    role: "rider",
    phone: "0700000007",
    salary: 500000,
    joinDate: "2023-05-01",
    isActive: true,
  }).returning();

  console.log("Employees seeded: 7");

  // ── 3. Users (all login accounts) ──────────────────────────────────────────
  await cockroachDb.insert(usersTable).values([
    {
      username: "shadrachssali@gmail.com",
      password: "admin123",
      name: "Shadrach Ssali",
      role: "admin",
      jobTitle: "System Administrator",
      employeeId: shadrachEmp.id,
      isActive: true,
    },
    {
      username: "martha@marbithbakery.com",
      password: "password123",
      name: "Martha Nakato",
      role: "admin",
      jobTitle: "Manager",
      employeeId: marthaEmp.id,
      isActive: true,
    },
    {
      username: "vivian@marbithbakery.com",
      password: "vivian123@",
      name: "Vivian Apio",
      role: "staff",
      jobTitle: "Senior Cashier",
      employeeId: vivianEmp.id,
      isActive: true,
    },
    {
      username: "sharon@marbithbakery.com",
      password: "@sharon123",
      name: "Sharon Nambi",
      role: "cashier",
      jobTitle: "Cashier",
      employeeId: sharonEmp.id,
      isActive: true,
    },
    {
      username: "samuel@marbithbakery.com",
      password: "123@samuel",
      name: "Samuel Kizza",
      role: "baker",
      jobTitle: "Head Baker",
      employeeId: samuelEmp.id,
      isActive: true,
    },
    {
      username: "kato@marbithbakery.com",
      password: "kato123@",
      name: "Kato Ssemakula",
      role: "baker",
      jobTitle: "Baker",
      employeeId: katoEmp.id,
      isActive: true,
    },
    {
      username: "rider1",
      password: "rider123",
      name: "Rider One",
      role: "rider",
      jobTitle: "Delivery Rider",
      employeeId: riderEmp.id,
      isActive: true,
    },
  ]);
  console.log("Users seeded: 7");

  // ── 4. Products + Inventory ─────────────────────────────────────────────────
  const products = [
    { name: "Pizza",            price: 5000,  unit: "piece", category: "baked_goods", lowStockThreshold: 5  },
    { name: "Rock Bun",         price: 1500,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    { name: "Cakes (6pcs)",     price: 2500,  unit: "pack",  category: "baked_goods", lowStockThreshold: 5  },
    { name: "Madeira Cake",     price: 1000,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    { name: "Vanilla Muffins",  price: 2000,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    { name: "Egg Rolls",        price: 2000,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    { name: "Sumbusa",          price: 1000,  unit: "piece", category: "snacks",      lowStockThreshold: 20 },
    { name: "Chapattis",        price: 1000,  unit: "piece", category: "baked_goods", lowStockThreshold: 15 },
    { name: "Mandazi (6pcs)",   price: 2500,  unit: "pack",  category: "baked_goods", lowStockThreshold: 5  },
    { name: "Plain Donuts",     price: 1000,  unit: "piece", category: "baked_goods", lowStockThreshold: 15 },
    { name: "Cookies",          price: 1000,  unit: "piece", category: "baked_goods", lowStockThreshold: 20 },
    { name: "Cinnamon Roll",    price: 1000,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    { name: "Teabites",         price: 3000,  unit: "pack",  category: "baked_goods", lowStockThreshold: 5  },
    { name: "American Donuts",  price: 2000,  unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
  ];

  for (const p of products) {
    const [product] = await cockroachDb.insert(productsTable).values({ ...p, isActive: true } as any).returning();
    await cockroachDb.insert(inventoryTable).values({ productId: product.id, currentStock: 50 });
  }
  console.log("Products seeded:", products.length);

  console.log("\n✓ Full CockroachDB seed complete!");
  console.log("\nLogin credentials:");
  console.log("  shadrachssali@gmail.com  /  admin123     (Admin)");
  console.log("  martha@marbithbakery.com /  password123  (Admin)");
  console.log("  vivian@marbithbakery.com /  vivian123@   (Staff)");
  console.log("  sharon@marbithbakery.com /  @sharon123   (Cashier)");
  console.log("  samuel@marbithbakery.com /  123@samuel   (Baker)");
  console.log("  kato@marbithbakery.com   /  kato123@     (Baker)");
  console.log("  rider1                   /  rider123     (Rider)");

  process.exit(0);
}

seedFull().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
