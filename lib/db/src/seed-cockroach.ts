import { cockroachDb } from "./index";
import { productsTable, inventoryTable } from "./schema";

async function seed() {
  console.log("Seeding CockroachDB...");

  const existingProducts = await cockroachDb.select().from(productsTable);
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
      const [product] = await cockroachDb.insert(productsTable).values({ ...p, isActive: true } as any).returning();
      await cockroachDb.insert(inventoryTable).values({ productId: product.id, currentStock: 50 });
    }
    console.log("Products seeded:", productsToSeed.length);
  } else {
    console.log("Products already exist:", existingProducts.length);
  }

  console.log("CockroachDB seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
