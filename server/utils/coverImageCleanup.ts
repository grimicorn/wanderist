/**
 * Cleanup for media left behind when a trip's cover image changes.
 *
 * Changing a trip's cover overwrites `trips.cover_image_id`, which would
 * otherwise orphan the previously-referenced media row and its Netlify Blobs
 * object forever. A media row can also be referenced by another trip's cover
 * or by an entry photo, so we only delete media that nothing else references.
 *
 * The Netlify Blobs interaction lives behind `mediaStore` so this logic can be
 * unit-tested without touching the network.
 */
import { eq, and } from "drizzle-orm";
import type { getDb } from "../db/index";
import { media, trips, entryPhotos } from "../db/schema";
import { removeMediaBlob, toThumbnailKey } from "./mediaStore";

type Database = ReturnType<typeof getDb>;

async function isMediaReferenced(
  database: Database,
  mediaId: string,
): Promise<boolean> {
  const coverReferences = await database
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.coverImageId, mediaId))
    .limit(1);

  if (coverReferences.length > 0) {
    return true;
  }

  const photoReferences = await database
    .select({ id: entryPhotos.id })
    .from(entryPhotos)
    .where(eq(entryPhotos.mediaId, mediaId))
    .limit(1);

  return photoReferences.length > 0;
}

// Blob removal is best-effort: a leaked blob can be reaped out-of-band, so a
// failure here is logged rather than thrown (which would surface a 500 on an
// otherwise-successful trip update).
async function removeBlobQuietly(storageKey: string): Promise<void> {
  try {
    await removeMediaBlob(storageKey);
  } catch (blobError) {
    console.error(
      `cover cleanup: blob removal failed for ${storageKey}`,
      blobError,
    );
  }
}

async function removeStoredBlobs(storageKey: string): Promise<void> {
  await removeBlobQuietly(storageKey);
  // The thumbnail may never have been generated (best-effort at upload time);
  // removeMediaBlob deleting a missing key is a no-op, not an error.
  await removeBlobQuietly(toThumbnailKey(storageKey));
}

/**
 * Throws 404 unless `mediaId` names a media row owned by `ownerId`. Guards the
 * PATCH from pointing a trip's cover at a nonexistent or another user's media
 * (the FK alone would surface a 500, and cross-user references would leak).
 */
export async function assertCoverImageOwned(
  database: Database,
  ownerId: string,
  mediaId: string,
): Promise<void> {
  const rows = await database
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, ownerId)))
    .limit(1);

  if (!rows[0]) {
    throw createError({
      statusCode: 404,
      statusMessage: "Cover image not found",
    });
  }
}

/**
 * Deletes the given media row and its blobs, but only when no trip cover or
 * entry photo still references it. Scoped to `ownerId` so cleanup can never
 * touch another user's media. Returns true when it deleted the media, false
 * when it left it in place (still referenced, or already gone).
 *
 * Call this only after the trip has been updated away from `mediaId`, so the
 * reference check does not see the trip that just released it.
 */
export async function deleteMediaIfUnreferenced(
  database: Database,
  ownerId: string,
  mediaId: string,
): Promise<boolean> {
  if (await isMediaReferenced(database, mediaId)) {
    return false;
  }

  // media.url holds the blob storage key (insertMediaRow sets url = storageKey),
  // so it is what removeMediaBlob/toThumbnailKey operate on.
  const rows = await database
    .select({ url: media.url })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, ownerId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return false;
  }

  // Delete the row first so the reference is gone even if blob removal fails;
  // an orphaned blob can be reaped out-of-band, an orphaned row cannot.
  await database
    .delete(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, ownerId)));

  await removeStoredBlobs(row.url);

  return true;
}
