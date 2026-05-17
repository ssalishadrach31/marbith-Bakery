import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool, types } = pg;

// Parse INT8 (OID 20) as JS number instead of string.
// CockroachDB returns SERIAL primary keys as 64-bit integers; without this
// every id comparison in Maps, inArray, etc. breaks silently.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

const neonUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!neonUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");
}

export const neonPool = new Pool({
  connectionString: neonUrl,
  ssl: { rejectUnauthorized: false },
});
export const neonDb = drizzle(neonPool, { schema });

if (!process.env.COCKROACH_DATABASE_URL) {
  throw new Error("COCKROACH_DATABASE_URL must be set");
}
export const cockroachPool = new Pool({
  connectionString: process.env.COCKROACH_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
export const cockroachDb = drizzle(cockroachPool, { schema });

export const pool = neonPool;
export const db = neonDb;

export * from "./schema";
