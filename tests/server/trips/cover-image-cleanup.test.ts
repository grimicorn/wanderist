/**
 * Tests for deleteMediaIfUnreferenced (cover image cleanup).
 *
 * The Netlify Blobs interaction is mocked at the mediaStore seam so no network
 * or real store is touched. The drizzle query builder is stubbed with a small
 * chainable fake that records which table each select/delete targeted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRemoveMediaBlob, mockToThumbnailKey } = vi.hoisted(() => ({
  mockRemoveMediaBlob: vi.fn().mockResolvedValue(undefined),
  mockToThumbnailKey: vi.fn((key: string) => `${key}-thumb`),
}));

vi.mock("../../../server/utils/mediaStore", () => ({
  removeMediaBlob: mockRemoveMediaBlob,
  toThumbnailKey: mockToThumbnailKey,
}));

Object.assign(globalThis, {
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
});

const { deleteMediaIfUnreferenced, assertCoverImageOwned } =
  await import("../../../server/utils/coverImageCleanup");
const { media, trips, entryPhotos } = await import("../../../server/db/schema");

const OWNER_ID = "user-1";
const MEDIA_ID = "media-1";
const MEDIA_URL = "user-1/media-1";

// ---------------------------------------------------------------------------
// Chainable drizzle fake
// ---------------------------------------------------------------------------

type SelectRows = Record<string, unknown>[];

// Returns a select() that resolves to different rows depending on the table
// passed to from(). Lets a single db stub answer the trips-reference query, the
// entry-photos-reference query, and the media-row lookup independently.
function makeDb(options: {
  tripRefs?: SelectRows;
  photoRefs?: SelectRows;
  mediaRows?: SelectRows;
}) {
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));

  function resolveRows(table: unknown): SelectRows {
    if (table === trips) {
      return options.tripRefs ?? [];
    }

    if (table === entryPhotos) {
      return options.photoRefs ?? [];
    }

    if (table === media) {
      return options.mediaRows ?? [];
    }

    return [];
  }

  const select = vi.fn(() => ({
    from: (table: unknown) => {
      const rows = resolveRows(table);
      const limit = vi.fn().mockResolvedValue(rows);
      return { where: vi.fn(() => ({ limit })) };
    },
  }));

  const database = { select, delete: deleteFrom };
  return { database, deleteFrom, deleteWhere };
}

describe("deleteMediaIfUnreferenced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks resets call history only, not implementations, so re-set
    // both mediaStore mocks here — otherwise the blob-failure test's rejection
    // would leak into any test added below it.
    mockToThumbnailKey.mockImplementation((key: string) => `${key}-thumb`);
    mockRemoveMediaBlob.mockResolvedValue(undefined);
  });

  it("deletes the row and both blobs when nothing else references the media", async () => {
    const { database, deleteFrom } = makeDb({
      mediaRows: [{ url: MEDIA_URL }],
    });

    const deleted = await deleteMediaIfUnreferenced(
      database as never,
      OWNER_ID,
      MEDIA_ID,
    );

    expect(deleted).toBe(true);
    expect(deleteFrom).toHaveBeenCalledWith(media);
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith(MEDIA_URL);
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith(`${MEDIA_URL}-thumb`);
  });

  it("does not delete when another trip still uses the media as its cover", async () => {
    const { database, deleteFrom } = makeDb({
      tripRefs: [{ id: "trip-2" }],
      mediaRows: [{ url: MEDIA_URL }],
    });

    const deleted = await deleteMediaIfUnreferenced(
      database as never,
      OWNER_ID,
      MEDIA_ID,
    );

    expect(deleted).toBe(false);
    expect(deleteFrom).not.toHaveBeenCalled();
    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
  });

  it("does not delete when an entry photo still references the media", async () => {
    const { database, deleteFrom } = makeDb({
      photoRefs: [{ id: "photo-9" }],
      mediaRows: [{ url: MEDIA_URL }],
    });

    const deleted = await deleteMediaIfUnreferenced(
      database as never,
      OWNER_ID,
      MEDIA_ID,
    );

    expect(deleted).toBe(false);
    expect(deleteFrom).not.toHaveBeenCalled();
    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
  });

  it("returns false without touching blobs when the media row is not found", async () => {
    const { database, deleteFrom } = makeDb({ mediaRows: [] });

    const deleted = await deleteMediaIfUnreferenced(
      database as never,
      OWNER_ID,
      MEDIA_ID,
    );

    expect(deleted).toBe(false);
    expect(deleteFrom).not.toHaveBeenCalled();
    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
  });

  it("still deletes the row and reports success when blob removal fails", async () => {
    const { database, deleteFrom } = makeDb({
      mediaRows: [{ url: MEDIA_URL }],
    });
    mockRemoveMediaBlob.mockRejectedValue(new Error("store unavailable"));

    const deleted = await deleteMediaIfUnreferenced(
      database as never,
      OWNER_ID,
      MEDIA_ID,
    );

    expect(deleted).toBe(true);
    expect(deleteFrom).toHaveBeenCalledWith(media);
  });
});

describe("assertCoverImageOwned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves when the media row is owned by the user", async () => {
    const { database } = makeDb({ mediaRows: [{ id: MEDIA_ID }] });

    await expect(
      assertCoverImageOwned(database as never, OWNER_ID, MEDIA_ID),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when the media row is missing or owned by another user", async () => {
    const { database } = makeDb({ mediaRows: [] });

    await expect(
      assertCoverImageOwned(database as never, OWNER_ID, MEDIA_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
