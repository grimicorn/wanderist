import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle> | null = null;

/**
 * Builds a drizzle client from an explicit connection string. Exported
 * separately from getDb() so callers that run outside the Nitro request
 * context — e.g. netlify/functions/purge-deleted-accounts.ts, a standalone
 * scheduled function bundled by Netlify rather than by Nitro, where
 * useRuntimeConfig() is not available — can construct a client from
 * process.env directly instead.
 */
export function createDb(databaseUrl: string) {
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export function getDb() {
  if (cachedDb) return cachedDb;
  const { databaseUrl } = useRuntimeConfig();
  cachedDb = createDb(databaseUrl);
  return cachedDb;
}
