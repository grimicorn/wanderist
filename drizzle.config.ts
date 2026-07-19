import { defineConfig } from "drizzle-kit";

// Migrations use a DIRECT (non-pooler) connection. In production that is
// DATABASE_URL_UNPOOLED (set in .env.production); e2e injects E2E_DATABASE_URL
// per run; local dev falls back to DATABASE_URL. The app itself uses the pooled
// DATABASE_URL via runtimeConfig — this preference only applies to drizzle-kit.
const databaseUrl =
  process.env.E2E_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required for Drizzle; please set one in your environment",
  );
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
