import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { media } from "../../db/schema";
import { getMediaBlob } from "../../utils/mediaStore";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

// This route is intentionally public (no auth). Media objects are addressed by
// UUIDs; the 128-bit key space is the access control. DELETE enforces ownership,
// so only the uploader can remove their media. If this changes to private storage,
// add requireUser() and scope the select by userId.
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

  const blob = await getMediaBlob(row.url);
  if (!blob) {
    throw createError({ statusCode: 404, statusMessage: "Blob not found" });
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
