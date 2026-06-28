import { getDb } from "../../db/index";
import { media } from "../../db/schema";
import { ensureUser } from "../../utils/auth";
import { putMediaBlob, removeMediaBlob } from "../../utils/mediaStore";

// 10 MB expressed in bytes.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

const FALLBACK_HOST = "localhost:3000";

function assertContentTypeAllowed(contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `Unsupported media type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
    });
  }
}

function assertFileSizeAllowed(byteLength: number): void {
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    });
  }
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);

  // Strip any parameters (e.g. "image/jpeg; charset=binary" → "image/jpeg").
  const contentType = (getHeader(event, "content-type") ?? "")
    .split(";")[0]
    .trim();
  assertContentTypeAllowed(contentType);

  // Reject early on Content-Length before buffering the body.
  // Note: `readRawBody` still reads the full payload into memory — this check
  // only rejects honest clients before they finish uploading. A malicious client
  // that omits Content-Length or sends less than the actual size bypasses the
  // early gate. The platform-level body size limit in nuxt.config (via Nitro's
  // `maxBodySize`) is the correct backstop for unbounded uploads.
  const declaredLength = Number(getHeader(event, "content-length") ?? 0);
  assertFileSizeAllowed(declaredLength);

  const rawBody = await readRawBody(event, false);
  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  // Re-check on actual byte length to catch clients that omit Content-Length.
  assertFileSizeAllowed(rawBody.byteLength);

  const mediaId = crypto.randomUUID();
  const storageKey = `${userId}/${mediaId}`;

  await putMediaBlob(storageKey, Buffer.from(rawBody), contentType);

  const db = getDb();
  let inserted: { id: string; url: string } | undefined;

  try {
    const insertedRows = await db
      .insert(media)
      .values({
        id: mediaId,
        userId,
        url: storageKey,
        contentType,
      })
      .returning({ id: media.id, url: media.url });

    inserted = insertedRows[0];
    if (!inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to insert media record",
      });
    }
  } catch (insertError) {
    // Clean up the blob so we do not leave storage orphaned.
    // If cleanup fails, log and re-throw the original insert error.
    try {
      await removeMediaBlob(storageKey);
    } catch (cleanupError) {
      console.error(
        `media post: blob cleanup failed for ${storageKey}`,
        cleanupError,
      );
    }
    throw insertError;
  }

  const host = getHeader(event, "host") ?? FALLBACK_HOST;
  const serveUrl = `${getRequestProtocol(event)}://${host}/api/media/${mediaId}`;

  setResponseStatus(event, 201);

  return {
    id: inserted.id,
    url: serveUrl,
  };
});
