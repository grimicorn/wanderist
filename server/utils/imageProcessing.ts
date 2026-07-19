/**
 * Thin abstraction over `sharp` so upload/delete handlers (and their tests)
 * never call the image library directly. Both functions are best-effort:
 * they log and return `null` on failure rather than throwing, so a bad or
 * unusual image never blocks the upload of the original file.
 */
import sharp from "sharp";

// Longest edge of a generated thumbnail, in pixels. Large enough for grid
// and list previews while staying well under the original file's size.
export const THUMBNAIL_MAX_DIMENSION_PX = 400;

export interface ImageDimensions {
  width: number;
  height: number;
}

// EXIF orientation values that represent a 90 or 270 degree rotation, where
// the image's displayed width/height are swapped relative to its raw pixel
// grid. See https://exiftool.org/TagNames/EXIF.html for the full tag table.
const EXIF_ORIENTATIONS_SWAPPING_DIMENSIONS = new Set([5, 6, 7, 8]);

/**
 * Reads width/height from image bytes, in the orientation the image is
 * actually displayed in. Returns null when the metadata is missing or the
 * buffer isn't a decodable image.
 *
 * `sharp().metadata()` returns the raw stored pixel grid and the EXIF
 * orientation tag; it does NOT apply that tag itself (queuing `.rotate()`
 * only affects pixel output on `.toBuffer()`, not `.metadata()`). A portrait
 * phone photo is commonly stored as a landscape pixel grid with an
 * orientation tag of 5-8, so we swap width/height ourselves for those tags.
 * This must stay in sync with generateThumbnail below, which auto-orients
 * via `.rotate()` on the actual pixel pipeline, or the two would disagree
 * on which edge is "width".
 */
export async function probeImageDimensions(
  buffer: Buffer,
): Promise<ImageDimensions | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return null;
    }

    const isRotated90Or270 = EXIF_ORIENTATIONS_SWAPPING_DIMENSIONS.has(
      metadata.orientation ?? 0,
    );
    return isRotated90Or270
      ? { width: metadata.height, height: metadata.width }
      : { width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error("probeImageDimensions: failed to read metadata", error);
    return null;
  }
}

/**
 * Resizes the image to fit within THUMBNAIL_MAX_DIMENSION_PX on its longest
 * edge, preserving aspect ratio and the source format. Normalizes EXIF
 * orientation first so rotated photos thumbnail upright. Returns null when
 * the buffer can't be processed.
 *
 * Reads only the first frame for animated GIF/WebP input (sharp's default),
 * so the thumbnail is a static preview even though it's stored under the
 * original's (animated) content type. This is deliberate: a still preview
 * is standard for grid/list thumbnails; pass `{ animated: true }` to sharp
 * here if animated thumbnails are ever wanted.
 */
export async function generateThumbnail(
  buffer: Buffer,
): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIMENSION_PX,
        height: THUMBNAIL_MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
  } catch (error) {
    console.error("generateThumbnail: failed to resize image", error);
    return null;
  }
}
