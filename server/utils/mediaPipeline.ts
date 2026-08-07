/**
 * Shared media-write pipeline used by every path that persists a media row
 * (direct upload and Instagram import). It composes the `imageProcessing`
 * (sharp) and `mediaStore` (Netlify Blobs) abstractions so the two write
 * paths produce consistent rows — same dimension probing, same thumbnail
 * generation, same blob layout — without duplicating the logic.
 */
import {
  generateThumbnail,
  probeImageDimensions,
  type ImageDimensions,
} from "./imageProcessing";
import { putMediaBlob, toThumbnailKey } from "./mediaStore";

export interface ProcessedImage {
  dimensions: ImageDimensions | null;
  thumbnailBuffer: Buffer | null;
}

// Best-effort: dimension probing and thumbnail generation never block the
// storage of the original. A failure here leaves width/height null and/or
// the thumbnail unwritten, which callers already treat as absent data.
export async function processMediaImage(
  buffer: Buffer,
): Promise<ProcessedImage> {
  // Independent, and each swallows its own errors, so running them together
  // just avoids an extra await in the per-photo import loop. Probing is
  // header-only; the resize is the expensive half.
  const [dimensions, thumbnailBuffer] = await Promise.all([
    probeImageDimensions(buffer),
    generateThumbnail(buffer),
  ]);
  return { dimensions, thumbnailBuffer };
}

// Stores the original under `storageKey` and, if a thumbnail was generated,
// stores it under the derived thumbnail key. Returns that key (or null) so
// the caller can record it for cleanup and response-building.
//
// A thumbnail *store* failure degrades the same way a thumbnail *generation*
// failure does (return null, keep going) rather than failing the whole
// request: the original is already durably stored at this point, and
// thumbnails are best-effort throughout. Failing here would both contradict
// that contract and orphan the already-stored original.
export async function storeMediaBlobs(
  storageKey: string,
  originalBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  contentType: string,
): Promise<string | null> {
  await putMediaBlob(storageKey, originalBuffer, contentType);

  if (!thumbnailBuffer) {
    return null;
  }

  const thumbnailKey = toThumbnailKey(storageKey);
  try {
    await putMediaBlob(thumbnailKey, thumbnailBuffer, contentType);
  } catch (thumbnailStoreError) {
    console.error(
      `storeMediaBlobs: thumbnail store failed for ${storageKey}`,
      thumbnailStoreError,
    );
    return null;
  }
  return thumbnailKey;
}
