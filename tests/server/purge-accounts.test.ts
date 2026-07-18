/**
 * Unit tests for server/utils/purgeAccounts.ts — the scheduled
 * purge-deleted-accounts job's DB-side isolation boundary.
 *
 * isPurgeable is tested directly as a pure predicate (no DB). Everything
 * else is exercised against a mocked drizzle db chain so no network or
 * database access is needed — the same pattern used by
 * tests/server/subscriptions-util.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE_GRACE_PERIOD_DAYS } from "../../server/utils/accountLifecycle";
import {
  isPurgeable,
  purgeExpiredDeletedAccounts,
} from "../../server/utils/purgeAccounts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

describe("purgeExpiredDeletedAccounts", () => {
  const mockDeleteReturning = vi.fn();
  const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
  const mockDb = { delete: mockDelete } as unknown as Parameters<
    typeof purgeExpiredDeletedAccounts
  >[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges rows the DB query returns and reports their ids", async () => {
    mockDeleteReturning.mockResolvedValue([
      { id: "user-past-grace-1" },
      { id: "user-past-grace-2" },
    ]);

    const result = await purgeExpiredDeletedAccounts(mockDb);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      purgedUserIds: ["user-past-grace-1", "user-past-grace-2"],
      purgedCount: 2,
    });
  });

  it("reports zero purged when nothing matches (rows within grace or never deleted)", async () => {
    mockDeleteReturning.mockResolvedValue([]);

    const result = await purgeExpiredDeletedAccounts(mockDb);

    expect(result).toEqual({ purgedUserIds: [], purgedCount: 0 });
  });

  it("scopes the delete to a single WHERE call built from the provided `now`", async () => {
    mockDeleteReturning.mockResolvedValue([]);
    const now = new Date("2026-08-01T00:00:00.000Z");

    await purgeExpiredDeletedAccounts(mockDb, now);

    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });
});
