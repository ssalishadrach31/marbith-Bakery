import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.COCKROACH_DATABASE_URL) {
  throw new Error("COCKROACH_DATABASE_URL must be set");
}

// Parse URL components so we can pass ssl: { rejectUnauthorized: false }
// (drizzle-kit honors the object form; the raw URL with sslmode=verify-full fails)
const raw = process.env.COCKROACH_DATABASE_URL;
const u = new URL(raw);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 26257,
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "defaultdb",
    ssl: { rejectUnauthorized: false },
  },
});
