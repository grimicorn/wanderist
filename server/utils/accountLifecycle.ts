/**
 * Shared constants for the soft-delete → hard-delete account lifecycle.
 *
 * DELETE /api/account (server/api/account/index.delete.ts) stamps
 * `users.deletedAt` and reports `gracePeriodEndsAt` back to the client.
 * netlify/functions/purge-deleted-accounts.mts hard-deletes any row whose
 * grace period has elapsed (FK CASCADE removes the child rows). Both sides
 * must agree on the same grace period, so it lives here as the single
 * source of truth rather than being duplicated in each file.
 */

// Grace period before a soft-deleted row and all FK CASCADE children are
// permanently purged.
export const DELETE_GRACE_PERIOD_DAYS = 14;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The instant at which a row soft-deleted at `deletedAt` becomes purgeable. */
export function gracePeriodEndsAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY);
}
