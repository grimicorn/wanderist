import { eq } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { media } from "../../../db/schema";
import { getMediaBlob, toThumbnailKey } from "../../../utils/mediaStore";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

// Same public-access rationale as ../[id].get.ts: media is addressed by
// UUID, and the 128-bit key space is the access control. 404s when no
// thumbnail was generated for this media (e.g. probing/resize failed at
// upload time) rather than falling back to the original.
export default defineEventHandler(async (event) => {
  const mediaId = getRouterParam(event, "id");
  if (!mediaId) {
    throw createError({ statusCode: 400, statusMessage: "Missing media id" });
  }

  const db = getDb();
  const rows = await db
    .select({ url: media.url, contentType: media.contentType })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const blob = await getMediaBlob(toThumbnailKey(row.url));
  if (!blob) {
    throw createError({
      statusCode: 404,
      statusMessage: "Thumbnail not found",
    });
  }

  const resolvedContentType =
    blob.contentType ?? row.contentType ?? FALLBACK_CONTENT_TYPE;

  setResponseHeader(event, "Content-Type", resolvedContentType);
  setResponseHeader(
    event,
    "Cache-Control",
    "public, max-age=31536000, immutable",
  );
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");

  return new Uint8Array(blob.data);
});
