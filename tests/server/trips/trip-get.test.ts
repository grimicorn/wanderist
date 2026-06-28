/**
 * Tests for GET /api/trips/[id] — single trip with stops and facts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoadOwnedOrThrow,
  mockGetRouterParam,
  mockCreateError,
  mockSelect,
  mockFrom,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockInnerJoin,
} = vi.hoisted(() => {
  const SAMPLE_TRIP = {
    id: "trip-1",
    userId: "user-1",
    name: "Iceland",
    status: "ongoing",
    startDate: null,
    endDate: null,
    distanceKm: 892,
    coverImageId: null,
    visibility: "private",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const SAMPLE_STOPS = [
    {
      id: "stop-1",
      tripId: "trip-1",
      name: "Reykjavík",
      sortOrder: 0,
      nights: 2,
      distanceKm: 100,
      status: "done",
      arriveDate: null,
      note: null,
      placeId: null,
    },
  ];

  const mockLoadOwnedOrThrow = vi.fn().mockResolvedValue(SAMPLE_TRIP);
  const mockGetRouterParam = vi.fn().mockReturnValue("trip-1");
  const mockCreateError = vi.fn(
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );

  const mockOrderBy = vi.fn().mockResolvedValue(SAMPLE_STOPS);
  const mockLimit = vi.fn().mockResolvedValue([{ total: 5 }]);
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere2 }));

  // Chain for tripStops: select().from().where().orderBy()
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));

  // Chain for entryPhotos: select().from().innerJoin().where()
  const mockWhere2 = vi.fn().mockResolvedValue([{ total: 5 }]);

  // We need both chains to work from the same select mock
  // The test will configure per-call behavior
  const mockSelect = vi.fn();

  return {
    mockLoadOwnedOrThrow,
    mockGetRouterParam,
    mockCreateError,
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockLimit,
    mockInnerJoin,
  };
});

vi.mock("../../../server/utils/db-helpers", () => ({
  loadOwnedOrThrow: mockLoadOwnedOrThrow,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({ select: mockSelect }),
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getRouterParam: mockGetRouterParam,
});

const { default: handler } = await import("@trips-id.get");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_TRIP = {
  id: "trip-1",
  userId: "user-1",
  name: "Iceland",
  status: "ongoing",
  startDate: null,
  endDate: null,
  distanceKm: 892,
  coverImageId: null,
  visibility: "private",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SAMPLE_STOPS = [
  {
    id: "stop-1",
    tripId: "trip-1",
    name: "Reykjavík",
    sortOrder: 0,
    nights: 2,
    distanceKm: 100,
    status: "done",
    arriveDate: null,
    note: null,
    placeId: null,
  },
];

function buildEvent() {
  return { context: { userId: "user-1" } };
}

function setupSelectChain() {
  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;

    if (callCount === 1) {
      // First call: tripStops query — .from().where().orderBy()
      const orderBy = vi.fn().mockResolvedValue(SAMPLE_STOPS);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from };
    }

    // Second call: entryPhotos count query — .from().innerJoin().where()
    const where = vi.fn().mockResolvedValue([{ total: 5 }]);
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    return { from };
  });
}

describe("GET /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockReturnValue("trip-1");
    mockLoadOwnedOrThrow.mockResolvedValue(SAMPLE_TRIP);
    setupSelectChain();
  });

  it("returns trip, stops, and facts for an owned trip", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trip: unknown; stops: unknown[]; facts: unknown };

    expect(result).toHaveProperty("trip");
    expect(result).toHaveProperty("stops");
    expect(result).toHaveProperty("facts");
    expect(result.trip).toMatchObject({ id: "trip-1" });
  });

  it("includes ordered stops in the response", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { stops: unknown[] };

    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]).toMatchObject({ name: "Reykjavík" });
  });

  it("computes facts including photo count", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { facts: { photoCount: number; stopCount: number } };

    expect(result.facts.photoCount).toBe(5);
    expect(result.facts.stopCount).toBe(1);
  });

  it("computes loggedDistanceKm as sum of stop distances", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { facts: { loggedDistanceKm: number | null } };

    expect(result.facts.loggedDistanceKm).toBe(100);
  });

  it("computes nights as sum of stop nights", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { facts: { nights: number | null } };

    expect(result.facts.nights).toBe(2);
  });

  it("throws 400 when no trip id is provided", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the trip does not belong to the user", async () => {
    mockLoadOwnedOrThrow.mockRejectedValue(
      Object.assign(new Error("Not found"), { statusCode: 404 }),
    );

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
