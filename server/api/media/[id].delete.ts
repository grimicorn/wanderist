import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/index";
import { media } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { removeMediaBlob } from "../../utils/mediaStore";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);

  const mediaId = getRouterParam(event, "id");
  if (!mediaId) {
    throw createError({ statusCode: 400, statusMessage: "Missing media id" });
  }

  const db = getDb();
  const rows = await db
    .select({ url: media.url })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Return 404 whether not found or owned by another user to avoid leaking existence.
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  // Delete the DB row first so the record is immediately gone to the user.
  // Blob removal runs after; if it fails we log and return success anyway —
  // the key only existed in this row, so a retry path via another DELETE is
  // impossible. Orphaned blobs can be cleaned up out-of-band.
  await db
    .delete(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, userId)));

  try {
    await removeMediaBlob(row.url);
  } catch (blobError) {
    console.error(
      `media delete: blob removal failed for ${row.url}`,
      blobError,
    );
  }

  return { ok: true };
});
