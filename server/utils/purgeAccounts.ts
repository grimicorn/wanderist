/**
 * Purge logic for soft-deleted users whose grace period has elapsed.
 *
 * Isolated from both the Nitro request context and the Netlify Functions
 * runtime that invokes it (netlify/functions/purge-deleted-accounts.mts) so
 * it can be unit tested with a plain mocked `db` object — no getDb()/
 * useRuntimeConfig() call inside this module. The only external service it
 * touches is Netlify Blobs, and that goes through the `mediaStore` seam
 * (removeMediaBlob/toThumbnailKey), which tests mock — so no real network
 * access happens under test.
 */
import { and, isNotNull, lt, inArray } from "drizzle-orm";
import type { createDb } from "../db/index";
import { users, media } from "../db/schema";
import { removeMediaBlob, toThumbnailKey } from "./mediaStore";
import { DELETE_GRACE_PERIOD_DAYS, MS_PER_DAY } from "./accountLifecycle";

export type PurgeDb = ReturnType<typeof createDb>;

export interface PurgeResult {
  purgedUserIds: string[];
  purgedCount: number;
  // Blob storage keys whose deletion failed during the run. Blob removal is
  // best-effort (a failure must not abort the purge), but the keys are
  // surfaced here so the caller can log/alert rather than report a clean run
  // while photo bytes leak — the account rows are already gone by then, so
  // nothing else records what leaked.
  failedBlobKeys: string[];
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
 * The SQL WHERE clause identifying purgeable rows. Both the candidate select
 * and the actual delete build from this one function so they can never drift
 * into deleting a different set than was inspected.
 */
function purgeablePredicate(cutoff: Date) {
  return and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff));
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

// Blob removal is best-effort: a failure is logged rather than thrown, which
// would abort the whole purge run and leave every remaining account unpurged
// over one bad blob key. Returns the key on failure (null on success) so the
// caller can accumulate and surface the leaked keys instead of hiding them.
async function removeBlobQuietly(storageKey: string): Promise<string | null> {
  try {
    await removeMediaBlob(storageKey);
    return null;
  } catch (blobError) {
    console.error(`purge: blob removal failed for ${storageKey}`, blobError);
    return storageKey;
  }
}

// Each media row's blob is stored under media.url (insertMediaRow sets
// url = storageKey), with its thumbnail under the derived -thumb key. The
// thumbnail may never have been generated, but deleting a missing key is a
// no-op, so both are attempted unconditionally. Returns the keys that failed.
async function removeStoredBlobs(storageKey: string): Promise<string[]> {
  const failedKeys: string[] = [];

  const originalFailure = await removeBlobQuietly(storageKey);
  if (originalFailure) {
    failedKeys.push(originalFailure);
  }

  const thumbnailFailure = await removeBlobQuietly(toThumbnailKey(storageKey));
  if (thumbnailFailure) {
    failedKeys.push(thumbnailFailure);
  }

  return failedKeys;
}

interface UserMediaBlob {
  userId: string;
  url: string;
}

/**
 * Reads the blob storage key (and owner) of every media row belonging to any
 * of `userIds`. Must run *before* the users are deleted: FK CASCADE removes
 * the media rows (and with them the only record of their blob keys) the moment
 * the users go, so the keys have to be captured into memory first.
 */
async function enumerateUserMediaBlobs(
  db: PurgeDb,
  userIds: string[],
): Promise<UserMediaBlob[]> {
  return db
    .select({ userId: media.userId, url: media.url })
    .from(media)
    .where(inArray(media.userId, userIds));
}

/**
 * Deletes the Netlify Blobs objects for the pre-enumerated media rows, but
 * only for users that were actually purged (`purgedUserIds`). Scoping to the
 * confirmed-purged set means a delete that removed fewer rows than expected
 * (or none, on failure) never destroys a surviving account's photos. Returns
 * any blob keys that failed to delete.
 */
async function removeBlobsForPurgedUsers(
  mediaBlobs: UserMediaBlob[],
  purgedUserIds: string[],
): Promise<string[]> {
  const purgedSet = new Set(purgedUserIds);
  const failedBlobKeys: string[] = [];

  for (const mediaBlob of mediaBlobs) {
    if (!purgedSet.has(mediaBlob.userId)) {
      continue;
    }
    const failures = await removeStoredBlobs(mediaBlob.url);
    failedBlobKeys.push(...failures);
  }

  return failedBlobKeys;
}

/**
 * Hard-deletes every `users` row soft-deleted (`deletedAt` set) more than
 * DELETE_GRACE_PERIOD_DAYS ago. FK CASCADE (ON DELETE CASCADE, see
 * server/db/schema.ts) removes every child row transitively — no manual
 * per-table cleanup is needed for the DB.
 *
 * The one thing CASCADE cannot reach is Netlify Blobs: the media rows carry
 * the blob storage keys, so this captures those keys first, deletes the users,
 * and only then deletes the blobs of the users it actually purged. Ordering
 * blob removal *after* the row delete means a failed delete leaves orphaned
 * bytes (recoverable, surfaced via failedBlobKeys) rather than destroying the
 * media of an account that survived. Without any of this, every purged account
 * leaks its photo bytes forever and they stay retrievable via /api/media/[id].
 *
 * Rows with `deletedAt` still null (never deleted) or within the grace
 * period are left untouched.
 */
export async function purgeExpiredDeletedAccounts(
  db: PurgeDb,
  now: Date = new Date(),
): Promise<PurgeResult> {
  const cutoff = purgeCutoff(now);

  const purgeable = await db
    .select({ id: users.id })
    .from(users)
    .where(purgeablePredicate(cutoff));

  const candidateUserIds = purgeable.map((row) => row.id);

  if (candidateUserIds.length === 0) {
    return { purgedUserIds: [], purgedCount: 0, failedBlobKeys: [] };
  }

  // Capture the blob keys while the media rows still exist to name them.
  const mediaBlobs = await enumerateUserMediaBlobs(db, candidateUserIds);

  // Delete on the same cutoff predicate (not a blind delete-by-id) so a row
  // that left the purgeable set between the select and here is never
  // hard-deleted; `.returning()` reports exactly what was removed.
  const purged = await db
    .delete(users)
    .where(purgeablePredicate(cutoff))
    .returning({ id: users.id });

  const purgedUserIds = purged.map((row) => row.id);

  // Only now, with the rows provably gone, remove the blobs.
  const failedBlobKeys = await removeBlobsForPurgedUsers(
    mediaBlobs,
    purgedUserIds,
  );

  return {
    purgedUserIds,
    purgedCount: purgedUserIds.length,
    failedBlobKeys,
  };
}
