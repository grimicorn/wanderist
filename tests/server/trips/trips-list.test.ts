/**
 * Tests for GET /api/trips — list, user-scoping, status filter, sort order
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockSelect,
  mockFrom,
  mockWhere,
  mockOrderBy,
  mockGetQuery,
  mockCreateError,
  mockEq,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockRequireUser = vi.fn().mockReturnValue("user-1");
  const mockGetQuery = vi.fn().mockReturnValue({});
  const mockCreateError = vi.fn(
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );
  const mockEq = vi.fn((...args: unknown[]) => ({ type: "eq", args }));

  return {
    mockRequireUser,
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockGetQuery,
    mockCreateError,
    mockEq,
  };
});

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({ select: mockSelect }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: mockEq };
});

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getQuery: mockGetQuery,
});

const { default: handler } =
  await import("../../../server/api/trips/index.get");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function buildEvent() {
  return { context: { userId: "user-1" } };
}

describe("GET /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({});
    mockOrderBy.mockResolvedValue([]);
  });

  it("returns the list of trips for the authenticated user", async () => {
    const sampleTrips = [
      { id: "t1", userId: "user-1", name: "Trip A", status: "ongoing" },
    ];
    mockOrderBy.mockResolvedValue(sampleTrips);

    const result = await (handler as (event: object) => unknown)(buildEvent());

    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(sampleTrips);
  });

  it("scopes the query to the authenticated user's id", async () => {
    mockRequireUser.mockReturnValue("user-42");
    mockOrderBy.mockResolvedValue([]);

    await (handler as (event: object) => unknown)({
      context: { userId: "user-42" },
    });

    // eq must have been called with the userId value somewhere in its args
    const eqCalls = mockEq.mock.calls;
    const hasUserIdFilter = eqCalls.some((args) => args.includes("user-42"));
    expect(hasUserIdFilter).toBe(true);
  });

  it("returns an empty array when the user has no trips", async () => {
    mockOrderBy.mockResolvedValue([]);

    const result = await (handler as (event: object) => unknown)(buildEvent());

    expect(result).toEqual([]);
  });

  it("applies a status filter when the status query param is provided", async () => {
    mockGetQuery.mockReturnValue({ status: "ongoing" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it("does not apply a status filter when status is 'All'", async () => {
    mockGetQuery.mockReturnValue({ status: "All" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it("throws 400 for an invalid status filter", async () => {
    mockGetQuery.mockReturnValue({ status: "invalid-status" });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("sorts ascending when sort=asc is provided", async () => {
    mockGetQuery.mockReturnValue({ sort: "asc" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it("defaults to descending sort when no sort param is provided", async () => {
    mockGetQuery.mockReturnValue({});

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it("throws 400 for an invalid sort value", async () => {
    mockGetQuery.mockReturnValue({ sort: "newest-first" });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
