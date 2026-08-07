/**
 * Unit tests for server/utils/purgeAccounts.ts — the scheduled
 * purge-deleted-accounts job's DB-side isolation boundary.
 *
 * isPurgeable is tested directly as a pure predicate (no DB). Everything
 * else is exercised against a mocked drizzle db chain so no network or
 * database access is needed — the same pattern used by
 * tests/server/subscriptions-util.test.ts. The Netlify Blobs interaction is
 * mocked at the mediaStore seam so the blob-cleanup path touches no real store.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DELETE_GRACE_PERIOD_DAYS,
  MS_PER_DAY,
} from "../../server/utils/accountLifecycle";
import { users, media } from "../../server/db/schema";

// Spy on drizzle-orm's `lt` (kept real via importOriginal) so the DB
// orchestration tests below can assert on the actual cutoff Date pushed into
// the SQL WHERE clause — not just that *some* where() call happened. This is
// what catches an off-by-one in purgeCutoff (server/utils/purgeAccounts.ts)
// that isPurgeable's own boundary tests wouldn't, since isPurgeable and the
// SQL filter share that one function but are otherwise independent call sites.
const { mockLt, mockInArray } = vi.hoisted(() => ({
  mockLt: vi.fn(),
  mockInArray: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    lt: (...args: Parameters<typeof actual.lt>) => {
      mockLt(...args);
      return actual.lt(...args);
    },
    // Spied so a test can assert the media enumeration is scoped to the
    // purged user ids — the db fake ignores its where() argument, so without
    // this a dropped/wrong `.where(inArray(...))` would delete every user's
    // blobs and still pass every assertion.
    inArray: (...args: Parameters<typeof actual.inArray>) => {
      mockInArray(...args);
      return actual.inArray(...args);
    },
  };
});

const { mockRemoveMediaBlob, mockToThumbnailKey } = vi.hoisted(() => ({
  mockRemoveMediaBlob: vi.fn().mockResolvedValue(undefined),
  mockToThumbnailKey: vi.fn((key: string) => `${key}-thumb`),
}));

vi.mock("../../server/utils/mediaStore", () => ({
  removeMediaBlob: mockRemoveMediaBlob,
  toThumbnailKey: mockToThumbnailKey,
}));

const { isPurgeable, purgeExpiredDeletedAccounts } =
  await import("../../server/utils/purgeAccounts");

// ---------------------------------------------------------------------------
// isPurgeable — pure predicate, no DB involved
// ---------------------------------------------------------------------------

describe("isPurgeable", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");

  it("returns true for a row whose grace period has elapsed", () => {
    const deletedAt = new Date(
      now.getTime() - (DELETE_GRACE_PERIOD_DAYS + 1) * MS_PER_DAY,
    );
    expect(isPurgeable(deletedAt, now)).toBe(true);
  });

  it("returns false for a row still within its grace period", () => {
    const deletedAt = new Date(
      now.getTime() - (DELETE_GRACE_PERIOD_DAYS - 1) * MS_PER_DAY,
    );
    expect(isPurgeable(deletedAt, now)).toBe(false);
  });

  it("returns false for a row that was never soft-deleted", () => {
    expect(isPurgeable(null, now)).toBe(false);
  });

  it("returns false at the exact grace-period boundary (not-yet-elapsed)", () => {
    const deletedAt = new Date(
      now.getTime() - DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY,
    );
    expect(isPurgeable(deletedAt, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// purgeExpiredDeletedAccounts — DB orchestration, mocked db chain
// ---------------------------------------------------------------------------

type Rows = Record<string, unknown>[];

// A chainable drizzle fake. select().from(table).where() resolves to the
// purgeable users when queried against `users` and to media rows when queried
// against `media`, so one stub answers both the user lookup and the blob-key
// enumeration. delete().where() records that a delete ran.
function makeDb(options: { userRows?: Rows; mediaRows?: Rows }) {
  // The delete re-runs the cutoff predicate and reports the rows it removed
  // via `.returning()`; the authoritative purged set is the same userRows the
  // select produced.
  const deleteReturning = vi.fn().mockResolvedValue(options.userRows ?? []);
  const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
  const mockDelete = vi.fn(() => ({ where: deleteWhere }));

  function rowsFor(table: unknown): Rows {
    if (table === users) {
      return options.userRows ?? [];
    }
    if (table === media) {
      return options.mediaRows ?? [];
    }
    return [];
  }

  const mockSelect = vi.fn(() => ({
    from: vi.fn((table: unknown) => ({
      where: vi.fn().mockResolvedValue(rowsFor(table)),
    })),
  }));

  const db = {
    select: mockSelect,
    delete: mockDelete,
  } as unknown as Parameters<typeof purgeExpiredDeletedAccounts>[0];

  return { db, mockDelete, deleteWhere, deleteReturning };
}

describe("purgeExpiredDeletedAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveMediaBlob.mockResolvedValue(undefined);
    mockToThumbnailKey.mockImplementation((key: string) => `${key}-thumb`);
  });

  it("purges the rows the cutoff query returns and reports their ids", async () => {
    const { db, mockDelete } = makeDb({
      userRows: [{ id: "user-past-grace-1" }, { id: "user-past-grace-2" }],
    });

    const result = await purgeExpiredDeletedAccounts(db);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      purgedUserIds: ["user-past-grace-1", "user-past-grace-2"],
      purgedCount: 2,
      failedBlobKeys: [],
    });
  });

  it("deletes every purged user's media blobs (original + thumbnail) before deleting the users", async () => {
    const { db, mockDelete, deleteWhere } = makeDb({
      userRows: [{ id: "user-1" }],
      mediaRows: [{ url: "user-1/media-1" }, { url: "user-1/media-2" }],
    });

    await purgeExpiredDeletedAccounts(db);

    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-1");
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-1-thumb");
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-2");
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-2-thumb");
    expect(mockRemoveMediaBlob).toHaveBeenCalledTimes(4);
    expect(mockDelete).toHaveBeenCalledTimes(1);

    // The whole point of the change: every blob removal must land before the
    // users are deleted, or FK CASCADE takes the media rows (and their keys)
    // out from under the enumeration.
    const lastBlobCall = Math.max(
      ...mockRemoveMediaBlob.mock.invocationCallOrder,
    );
    expect(lastBlobCall).toBeLessThan(deleteWhere.mock.invocationCallOrder[0]);
  });

  it("scopes the media enumeration to the purged users (never every user's blobs)", async () => {
    const { db } = makeDb({
      userRows: [{ id: "user-1" }, { id: "user-2" }],
      mediaRows: [{ url: "user-1/media-1" }],
    });

    await purgeExpiredDeletedAccounts(db);

    expect(mockInArray).toHaveBeenCalledWith(media.userId, [
      "user-1",
      "user-2",
    ]);
  });

  it("still deletes the users when there are no media rows to clean up", async () => {
    const { db, mockDelete } = makeDb({
      userRows: [{ id: "user-1" }],
      mediaRows: [],
    });

    await purgeExpiredDeletedAccounts(db);

    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("treats a blob-removal failure as best-effort: logs it but still purges the account", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRemoveMediaBlob.mockRejectedValueOnce(new Error("blob store down"));

    const { db, mockDelete } = makeDb({
      userRows: [{ id: "user-1" }],
      mediaRows: [{ url: "user-1/media-1" }],
    });

    const result = await purgeExpiredDeletedAccounts(db);

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    // The original blob's key is surfaced as failed; the thumbnail succeeded.
    expect(result).toEqual({
      purgedUserIds: ["user-1"],
      purgedCount: 1,
      failedBlobKeys: ["user-1/media-1"],
    });
    consoleSpy.mockRestore();
  });

  it("reports zero purged and touches no blobs or deletes when nothing matches", async () => {
    const { db, mockDelete } = makeDb({ userRows: [] });

    const result = await purgeExpiredDeletedAccounts(db);

    expect(result).toEqual({
      purgedUserIds: [],
      purgedCount: 0,
      failedBlobKeys: [],
    });
    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("filters on the exact cutoff derived from `now` and DELETE_GRACE_PERIOD_DAYS", async () => {
    const { db } = makeDb({ userRows: [{ id: "user-1" }] });
    const now = new Date("2026-08-01T00:00:00.000Z");
    const expectedCutoff = new Date(
      now.getTime() - DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY,
    );

    await purgeExpiredDeletedAccounts(db, now);

    // Called twice — once for the purgeable-user select, once for the delete —
    // both from the same purgeCutoff, so both must carry the identical cutoff.
    expect(mockLt).toHaveBeenCalledTimes(2);
    expect(mockLt).toHaveBeenNthCalledWith(1, users.deletedAt, expectedCutoff);
    expect(mockLt).toHaveBeenNthCalledWith(2, users.deletedAt, expectedCutoff);
  });

  it("propagates a delete failure (after blobs are gone) so the run is recorded as failed", async () => {
    const { db, deleteReturning } = makeDb({
      userRows: [{ id: "user-1" }],
      mediaRows: [{ url: "user-1/media-1" }],
    });
    deleteReturning.mockRejectedValue(new Error("DB unreachable"));

    await expect(purgeExpiredDeletedAccounts(db)).rejects.toThrow(
      "DB unreachable",
    );
    // Blob cleanup already ran; the caller surfaces the failure rather than
    // reporting a clean purge.
    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-1");
  });
});
