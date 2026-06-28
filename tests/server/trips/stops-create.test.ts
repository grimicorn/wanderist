/**
 * Tests for POST /api/trips/[id]/stops
 *
 * The handler file lives under a Nitro-style bracketed path ([id]) which
 * vite's static import analysis cannot resolve via a bare string literal.
 * We use the @trips-id-stops-handler alias defined in vitest.config.ts to
 * let vite resolve the path without treating [ ] as glob characters.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoadOwnedOrThrow,
  mockGetRouterParam,
  mockReadBody,
  mockCreateError,
  mockInsert,
  mockValues,
  mockReturning,
  mockSelect,
  mockFrom,
  mockWhere,
} = vi.hoisted(() => {
  const NEW_STOP = {
    id: "stop-new",
    tripId: "trip-1",
    name: "Reykjavík",
    status: "planned",
    sortOrder: 0,
    arriveDate: null,
    nights: null,
    distanceKm: null,
    note: null,
    placeId: null,
  };

  const mockReturning = vi.fn().mockResolvedValue([NEW_STOP]);
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockWhere = vi.fn().mockResolvedValue([{ maxOrder: null }]);
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    mockLoadOwnedOrThrow: vi.fn().mockResolvedValue({ id: "trip-1" }),
    mockGetRouterParam: vi.fn().mockReturnValue("trip-1"),
    mockReadBody: vi.fn().mockResolvedValue({ name: "Reykjavík" }),
    mockCreateError: vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    ),
    mockInsert,
    mockValues,
    mockReturning,
    mockSelect,
    mockFrom,
    mockWhere,
  };
});

vi.mock("../../../server/utils/db-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../server/utils/db-helpers")>();
  return {
    ...actual,
    loadOwnedOrThrow: mockLoadOwnedOrThrow,
  };
});

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({
    select: mockSelect,
    insert: mockInsert,
  }),
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getRouterParam: mockGetRouterParam,
  readBody: mockReadBody,
});

// Stub crypto.randomUUID without overwriting the read-only crypto global
vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
  "stop-new" as ReturnType<typeof crypto.randomUUID>,
);

const { default: handler } = await import("@trips-id-stops-handler/index.post");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const NEW_STOP = {
  id: "stop-new",
  tripId: "trip-1",
  name: "Reykjavík",
  status: "planned",
  sortOrder: 0,
  arriveDate: null,
  nights: null,
  distanceKm: null,
  note: null,
  placeId: null,
};

function buildEvent() {
  return { context: { userId: "user-1" } };
}

describe("POST /api/trips/[id]/stops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockReturnValue("trip-1");
    mockLoadOwnedOrThrow.mockResolvedValue({ id: "trip-1" });
    mockReadBody.mockResolvedValue({ name: "Reykjavík" });
    mockWhere.mockResolvedValue([{ maxOrder: null }]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockReturning.mockResolvedValue([NEW_STOP]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "stop-new" as ReturnType<typeof crypto.randomUUID>,
    );
  });

  it("creates a stop and returns it", async () => {
    const result = await (handler as (event: object) => Promise<unknown>)(
      buildEvent(),
    );

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Reykjavík",
        tripId: "trip-1",
        status: "planned",
        sortOrder: 0,
      }),
    );
    expect(result).toMatchObject({ name: "Reykjavík" });
  });

  it("assigns sortOrder as one higher than existing max", async () => {
    mockWhere.mockResolvedValue([{ maxOrder: 4 }]);

    await (handler as (event: object) => Promise<unknown>)(buildEvent());

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 5 }),
    );
  });

  it("assigns sortOrder 0 when there are no existing stops", async () => {
    mockWhere.mockResolvedValue([{ maxOrder: null }]);

    await (handler as (event: object) => Promise<unknown>)(buildEvent());

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 0 }),
    );
  });

  it("throws 400 when name is missing", async () => {
    mockReadBody.mockResolvedValue({});

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid stop status", async () => {
    mockReadBody.mockResolvedValue({ name: "Stop", status: "invalid" });

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when trip id is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the trip does not belong to the user", async () => {
    mockLoadOwnedOrThrow.mockRejectedValue(
      Object.assign(new Error("Not found"), { statusCode: 404 }),
    );

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
