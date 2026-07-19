/**
 * Purge logic for soft-deleted users whose grace period has elapsed.
 *
 * Isolated from both the Nitro request context and the Netlify Functions
 * runtime that invokes it (netlify/functions/purge-deleted-accounts.mts) so
 * it can be unit tested with a plain mocked `db` object — no getDb()/
 * useRuntimeConfig() call inside this module, and no network access.
 */
import { and, isNotNull, lt } from "drizzle-orm";
import type { createDb } from "../db/index";
import { users } from "../db/schema";
import { DELETE_GRACE_PERIOD_DAYS, MS_PER_DAY } from "./accountLifecycle";

export type PurgeDb = ReturnType<typeof createDb>;

export interface PurgeResult {
  purgedUserIds: string[];
  purgedCount: number;
}

/**
 * The instant before which a row's `deletedAt` makes it purgeable, relative
 * to `now`. Both isPurgeable and the SQL query below derive from this single
 * function so the predicate that's unit tested (isPurgeable) and the
 * predicate that actually runs against the database (the `lt()` filter
 * built from this cutoff) can never drift apart.
 */
function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY);
}

/**
 * The business rule this job enforces, extracted as a pure, directly
 * testable predicate: a row is purgeable once more than
 * DELETE_GRACE_PERIOD_DAYS have passed since `deletedAt`. A never-deleted
 * row (`deletedAt` null) is never purgeable.
 */
export function isPurgeable(deletedAt: Date | null, now: Date): boolean {
  if (!deletedAt) {
    return false;
  }
  return deletedAt < purgeCutoff(now);
}

/**
 * Hard-deletes every `users` row soft-deleted (`deletedAt` set) more than
 * DELETE_GRACE_PERIOD_DAYS ago. FK CASCADE (ON DELETE CASCADE, see
 * server/db/schema.ts) removes every child row transitively — no manual
 * per-table cleanup is needed here.
 *
 * Rows with `deletedAt` still null (never deleted) or within the grace
 * period are left untouched.
 */
export async function purgeExpiredDeletedAccounts(
  db: PurgeDb,
  now: Date = new Date(),
): Promise<PurgeResult> {
  const cutoff = purgeCutoff(now);

  const purged = await db
    .delete(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)))
    .returning({ id: users.id });

  return {
    purgedUserIds: purged.map((row) => row.id),
    purgedCount: purged.length,
  };
}
