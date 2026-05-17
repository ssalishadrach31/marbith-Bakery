import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Aliases for backwards compatibility with existing routes
export const neonPool = pool;
export const neonDb = db;
export const cockroachPool = pool;
export const cockroachDb = db;

export * from "./schema";
