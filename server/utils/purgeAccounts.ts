/**
 * Purge logic for soft-deleted users whose grace period has elapsed.
 *
 * Isolated from both the Nitro request context and the Netlify Functions
 * runtime that invokes it (netlify/functions/purge-deleted-accounts.ts) so
 * it can be unit tested with a plain mocked `db` object — no getDb()/
 * useRuntimeConfig() call inside this module, and no network access.
 */
import { and, isNotNull, lt } from "drizzle-orm";
import type { createDb } from "../db/index";
import { users } from "../db/schema";
import {
  DELETE_GRACE_PERIOD_DAYS,
  MS_PER_DAY,
  gracePeriodEndsAt,
} from "./accountLifecycle";

export type PurgeDb = ReturnType<typeof createDb>;

export interface PurgeResult {
  purgedUserIds: string[];
  purgedCount: number;
}

/**
 * The business rule this job enforces, extracted as a pure, directly
 * testable predicate: a row is purgeable once its grace period (from
 * gracePeriodEndsAt — the same calculation DELETE /api/account reports to
 * the client as `gracePeriodEndsAt`) has elapsed. A never-deleted row
 * (`deletedAt` null) is never purgeable.
 */
export function isPurgeable(deletedAt: Date | null, now: Date): boolean {
  if (!deletedAt) {
    return false;
  }
  return gracePeriodEndsAt(deletedAt) < now;
}

/**
 * The instant before which a row's `deletedAt` makes it purgeable, relative
 * to `now`. Equivalent to isPurgeable's threshold, expressed the other way
 * round (as a Date to compare `deletedAt` against) so it can be pushed down
 * into the SQL `WHERE` clause below instead of fetching every soft-deleted
 * row and filtering in JS.
 */
function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY);
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
