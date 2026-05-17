import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool, types } = pg;

// Parse INT8 (OID 20) as JS number instead of string.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

const cockroachUrl = process.env.COCKROACH_DATABASE_URL;
if (!cockroachUrl) {
  throw new Error("COCKROACH_DATABASE_URL must be set");
}

// All data lives in CockroachDB. Neon is kept as a future backup only.
export const cockroachPool = new Pool({
  connectionString: cockroachUrl,
  ssl: { rejectUnauthorized: false },
});
export const cockroachDb = drizzle(cockroachPool, { schema });

// Both neonDb and db are aliases for cockroachDb so all routes work unchanged.
export const neonPool = cockroachPool;
export const neonDb = cockroachDb;
export const pool = cockroachPool;
export const db = cockroachDb;

export * from "./schema";
