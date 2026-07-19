import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  // Prefer the live env var over runtimeConfig, matching every other server
  // file's `process.env.X || useRuntimeConfig().x` pattern. This is load-bearing
  // under dotenvx: `nuxt dev` auto-loads the committed (encrypted) .env and bakes
  // its `DATABASE_URL=encrypted:…` ciphertext into runtimeConfig.databaseUrl. In
  // e2e/CI the real connection arrives at runtime via E2E_DATABASE_URL (a fresh
  // Neon branch), so reading process.env first lets it win over that ciphertext.
  // In production both env vars are unset at runtime and the build-baked
  // runtimeConfig value (injected from process.env at build) is used.
  const databaseUrl =
    process.env.E2E_DATABASE_URL ||
    process.env.DATABASE_URL ||
    useRuntimeConfig().databaseUrl;
  if (!databaseUrl) throw new Error("Missing DATABASE_URL runtime config");
  const sql = neon(databaseUrl);
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}
