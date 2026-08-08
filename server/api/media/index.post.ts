import type { H3Event } from "h3";
import { getDb } from "../../db/index";
import { media } from "../../db/schema";
import { ensureUser } from "../../utils/auth";
import { removeMediaBlob } from "../../utils/mediaStore";
import { assertPhotoLimit } from "../../utils/planLimits";
import type { ImageDimensions } from "../../utils/imageProcessing";
import { processMediaImage, storeMediaBlobs } from "../../utils/mediaPipeline";

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

interface InsertedMediaRow {
  id: string;
  url: string;
}

interface MediaRowInput {
  mediaId: string;
  userId: string;
  storageKey: string;
  thumbnailKey: string | null;
  contentType: string;
  dimensions: ImageDimensions | null;
}

interface UploadResponseUrls {
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

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

function resolveContentType(event: H3Event): string {
  // Strip any parameters (e.g. "image/jpeg; charset=binary" → "image/jpeg").
  return (getHeader(event, "content-type") ?? "").split(";")[0].trim();
}

// Reject early on Content-Length before buffering the body.
// Note: `readRawBody` still reads the full payload into memory — this check
// only rejects honest clients before they finish uploading. A malicious client
// that omits Content-Length or sends less than the actual size bypasses the
// early gate. The platform-level body size limit in nuxt.config (via Nitro's
// `maxBodySize`) is the correct backstop for unbounded uploads.
async function readValidatedUploadBuffer(event: H3Event): Promise<Buffer> {
  const declaredLength = Number(getHeader(event, "content-length") ?? 0);
  assertFileSizeAllowed(declaredLength);

  const rawBody = await readRawBody(event, false);
  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  // Re-check on actual byte length to catch clients that omit Content-Length.
  assertFileSizeAllowed(rawBody.byteLength);

  return Buffer.from(rawBody);
}

async function cleanupOrphanedBlobs(
  storageKey: string,
  thumbnailKey: string | null,
): Promise<void> {
  try {
    await removeMediaBlob(storageKey);
    if (thumbnailKey) {
      await removeMediaBlob(thumbnailKey);
    }
  } catch (cleanupError) {
    console.error(
      `media post: blob cleanup failed for ${storageKey}`,
      cleanupError,
    );
  }
}

// Inserts the media row. On failure, cleans up the blob(s) already written
// so storage doesn't end up with an orphaned original and/or thumbnail, then
// re-throws the original insert error.
async function insertMediaRow(input: MediaRowInput): Promise<InsertedMediaRow> {
  const db = getDb();

  try {
    const insertedRows = await db
      .insert(media)
      .values({
        id: input.mediaId,
        userId: input.userId,
        url: input.storageKey,
        contentType: input.contentType,
        width: input.dimensions?.width ?? null,
        height: input.dimensions?.height ?? null,
      })
      .returning({ id: media.id, url: media.url });

    const inserted = insertedRows[0];
    if (!inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to insert media record",
      });
    }
    return inserted;
  } catch (insertError) {
    await cleanupOrphanedBlobs(input.storageKey, input.thumbnailKey);
    throw insertError;
  }
}

function buildUploadResponseUrls(
  event: H3Event,
  mediaId: string,
  thumbnailKey: string | null,
  dimensions: ImageDimensions | null,
): UploadResponseUrls {
  const host = getHeader(event, "host") ?? FALLBACK_HOST;
  const protocol = getRequestProtocol(event);
  const url = `${protocol}://${host}/api/media/${mediaId}`;
  const thumbnailUrl = thumbnailKey
    ? `${protocol}://${host}/api/media/${mediaId}/thumbnail`
    : null;

  return {
    url,
    thumbnailUrl,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  await assertPhotoLimit(userId);

  const contentType = resolveContentType(event);
  assertContentTypeAllowed(contentType);

  const originalBuffer = await readValidatedUploadBuffer(event);

  const mediaId = crypto.randomUUID();
  const storageKey = `${userId}/${mediaId}`;

  const { dimensions, thumbnailBuffer } =
    await processMediaImage(originalBuffer);
  const thumbnailKey = await storeMediaBlobs(
    storageKey,
    originalBuffer,
    thumbnailBuffer,
    contentType,
  );

  const inserted = await insertMediaRow({
    mediaId,
    userId,
    storageKey,
    thumbnailKey,
    contentType,
    dimensions,
  });

  const responseUrls = buildUploadResponseUrls(
    event,
    mediaId,
    thumbnailKey,
    dimensions,
  );

  setResponseStatus(event, 201);

  return {
    id: inserted.id,
    ...responseUrls,
  };
});
