import { db } from "./index";
import { usersTable, productsTable, inventoryTable, employeesTable } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Seed employees first
  const existingEmps = await db.select().from(employeesTable);
  let adminEmpId: number | null = null;
  let cashierEmpId: number | null = null;
  let riderEmpId: number | null = null;

  if (existingEmps.length === 0) {
    const [adminEmp] = await db.insert(employeesTable).values({
      name: "John Doe",
      role: "admin",
      phone: "0700000001",
      joinDate: "2024-01-01",
      salary: 1500000,
    }).returning();
    adminEmpId = adminEmp.id;

    const [cashierEmp] = await db.insert(employeesTable).values({
      name: "Jane Nakato",
      role: "cashier",
      phone: "0700000002",
      joinDate: "2024-01-15",
      salary: 600000,
    }).returning();
    cashierEmpId = cashierEmp.id;

    const [riderEmp] = await db.insert(employeesTable).values({
      name: "Ali Mukasa",
      role: "rider",
      phone: "0700000003",
      joinDate: "2024-02-01",
      salary: 400000,
    }).returning();
    riderEmpId = riderEmp.id;

    console.log("Employees seeded:", adminEmpId, cashierEmpId, riderEmpId);
  } else {
    const roles = existingEmps.reduce((m, e) => { m[e.role] = e.id; return m; }, {} as Record<string, number>);
    adminEmpId = roles.admin ?? null;
    cashierEmpId = roles.cashier ?? null;
    riderEmpId = roles.rider ?? null;
    console.log("Employees already exist, skipping");
  }

  // Seed users
  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length === 0) {
    await db.insert(usersTable).values([
      {
        username: "shadrachssali@gmail.com",
        password: "admin123",
        name: "Shadrach Ssali",
        role: "admin",
        employeeId: adminEmpId,
        isActive: true,
      },
      {
        username: "cashier1",
        password: "staff123",
        name: "Jane Nakato",
        role: "staff",
        employeeId: cashierEmpId,
        isActive: true,
      },
      {
        username: "rider1",
        password: "rider123",
        name: "Ali Mukasa",
        role: "rider",
        employeeId: riderEmpId,
        isActive: true,
      },
    ]);
    console.log("Users seeded");
  } else {
    console.log("Users already exist, skipping");
  }

  // Seed products
  const existingProducts = await db.select().from(productsTable);
  if (existingProducts.length === 0) {
    const productsToSeed = [
      { name: "Pizza", price: 5000, unit: "piece", category: "baked_goods", lowStockThreshold: 5 },
      { name: "Rock Bun", price: 1500, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
      { name: "Cakes (6pcs)", price: 2500, unit: "pack", category: "baked_goods", lowStockThreshold: 5 },
      { name: "Madeira Cake", price: 1000, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
      { name: "Vanilla Muffins", price: 2000, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
      { name: "Egg Rolls", price: 2000, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
      { name: "Sumbusa", price: 1000, unit: "piece", category: "snacks", lowStockThreshold: 20 },
      { name: "Chapattis", price: 1000, unit: "piece", category: "baked_goods", lowStockThreshold: 15 },
      { name: "Mandazi (6pcs)", price: 2500, unit: "pack", category: "baked_goods", lowStockThreshold: 5 },
      { name: "Plain Donuts", price: 1000, unit: "piece", category: "baked_goods", lowStockThreshold: 15 },
      { name: "Cookies", price: 1000, unit: "piece", category: "baked_goods", lowStockThreshold: 20 },
      { name: "Cinnamon Roll", price: 1000, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
      { name: "Teabites", price: 3000, unit: "pack", category: "baked_goods", lowStockThreshold: 5 },
      { name: "American Donuts", price: 2000, unit: "piece", category: "baked_goods", lowStockThreshold: 10 },
    ];

    for (const p of productsToSeed) {
      const [product] = await db.insert(productsTable).values({ ...p, isActive: true }).returning();
      await db.insert(inventoryTable).values({ productId: product.id, currentStock: 50 });
    }
    console.log("Products seeded:", productsToSeed.length);
  } else {
    console.log("Products already exist, skipping");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
