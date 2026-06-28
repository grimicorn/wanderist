/**
 * Tests for GET /api/stats — auth scoping and response shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any module imports
// ---------------------------------------------------------------------------

const { mockRequireUser, mockAggregateUserStats, mockCreateError } = vi.hoisted(
  () => {
    const mockRequireUser = vi.fn().mockReturnValue("user-1");
    const mockAggregateUserStats = vi.fn();
    const mockCreateError = vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    );

    return { mockRequireUser, mockAggregateUserStats, mockCreateError };
  },
);

vi.mock("../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../server/db/index", () => ({
  getDb: () => ({}),
}));

vi.mock("../../server/utils/stats-queries", () => ({
  aggregateUserStats: mockAggregateUserStats,
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
});

const { default: handler } = await import("../../server/api/stats.get");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_STATS = {
  placesCount: 117,
  countriesCount: 9,
  totalDistanceKm: 77600,
  totalDistanceMi: 48218,
  currentStreak: 14,
  placesThisWeek: 6,
  distanceKmThisWeek: 2254,
  distanceMiThisWeek: 1400,
  distanceUnit: "mi",
};

function buildEvent() {
  return { context: { userId: "user-1" } };
}

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockAggregateUserStats.mockResolvedValue(SAMPLE_STATS);
  });

  it("returns aggregated stats for the authenticated user", async () => {
    const result = await (handler as (event: object) => unknown)(buildEvent());

    expect(result).toEqual(SAMPLE_STATS);
    expect(mockAggregateUserStats).toHaveBeenCalledTimes(1);
  });

  it("passes the authenticated userId to aggregateUserStats", async () => {
    mockRequireUser.mockReturnValue("user-42");
    mockAggregateUserStats.mockResolvedValue({ ...SAMPLE_STATS });

    await (handler as (event: object) => unknown)({
      context: { userId: "user-42" },
    });

    expect(mockAggregateUserStats.mock.calls[0]?.[1]).toBe("user-42");
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("propagates errors from aggregateUserStats", async () => {
    mockAggregateUserStats.mockRejectedValue(new Error("DB connection failed"));

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toThrow("DB connection failed");
  });
});
