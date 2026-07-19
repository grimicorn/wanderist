/**
 * Unit tests for the dimension-probe + thumbnail seam. These run against
 * real `sharp` (no mocking) with synthetically generated test images, so a
 * regression in the actual probing/resizing logic fails these tests, not
 * just the route-level mocks in media.test.ts.
 */
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  probeImageDimensions,
  generateThumbnail,
  THUMBNAIL_MAX_DIMENSION_PX,
} from "../../server/utils/imageProcessing";

function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe("probeImageDimensions", () => {
  it("returns the width and height of a known test image", async () => {
    const buffer = await createTestImage(800, 600);

    const dimensions = await probeImageDimensions(buffer);

    expect(dimensions).toEqual({ width: 800, height: 600 });
  });

  it("returns null for a buffer that is not a decodable image", async () => {
    const dimensions = await probeImageDimensions(Buffer.from("not-an-image"));

    expect(dimensions).toBeNull();
  });

  it("swaps width/height for a portrait photo stored as a landscape pixel grid with EXIF orientation 6", async () => {
    // Common phone-camera case: sensor writes an 800x600 pixel grid plus an
    // EXIF orientation tag saying "rotate 90 CW to display correctly", so
    // the photo is actually a 600x800 portrait image.
    const landscapeGrid = await createTestImage(800, 600);
    const buffer = await sharp(landscapeGrid)
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const dimensions = await probeImageDimensions(buffer);

    expect(dimensions).toEqual({ width: 600, height: 800 });
  });

  it("does not swap dimensions for EXIF orientations that don't rotate 90/270 degrees", async () => {
    const buffer = await sharp(await createTestImage(800, 600))
      .withMetadata({ orientation: 3 }) // 180-degree rotation; no swap
      .toBuffer();

    const dimensions = await probeImageDimensions(buffer);

    expect(dimensions).toEqual({ width: 800, height: 600 });
  });
});

describe("generateThumbnail", () => {
  it("produces a thumbnail bounded by THUMBNAIL_MAX_DIMENSION_PX and preserves aspect ratio", async () => {
    const buffer = await createTestImage(1600, 1200); // 4:3

    const thumbnail = await generateThumbnail(buffer);
    expect(thumbnail).not.toBeNull();

    const thumbnailDimensions = await probeImageDimensions(thumbnail as Buffer);
    expect(thumbnailDimensions).toEqual({
      width: THUMBNAIL_MAX_DIMENSION_PX,
      height: 300,
    });
  });

  it("does not upscale an image already smaller than the thumbnail size", async () => {
    const buffer = await createTestImage(100, 80);

    const thumbnail = await generateThumbnail(buffer);
    const thumbnailDimensions = await probeImageDimensions(thumbnail as Buffer);

    expect(thumbnailDimensions).toEqual({ width: 100, height: 80 });
  });

  it("returns null for a buffer that is not a decodable image", async () => {
    const thumbnail = await generateThumbnail(Buffer.from("not-an-image"));

    expect(thumbnail).toBeNull();
  });
});
