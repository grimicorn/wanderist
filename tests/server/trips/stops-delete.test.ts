/**
 * Tests for DELETE /api/trips/[id]/stops/[stopId]
 *
 * Uses the @trips-id-stopid.delete alias from vitest.config.ts to work around
 * vite's static import analysis rejecting bracketed path segments.
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
  mockSelectWhere,
  mockSelectLimit,
  mockDelete,
  mockDeleteWhere,
} = vi.hoisted(() => {
  const EXISTING_STOP = { id: "stop-1", tripId: "trip-1" };

  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const mockSelectLimit = vi.fn().mockResolvedValue([EXISTING_STOP]);
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    mockLoadOwnedOrThrow: vi.fn().mockResolvedValue({ id: "trip-1" }),
    mockGetRouterParam: vi
      .fn()
      .mockImplementation((_, key: string) =>
        key === "id" ? "trip-1" : "stop-1",
      ),
    mockCreateError: vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    ),
    mockSelect,
    mockFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockDelete,
    mockDeleteWhere,
  };
});

vi.mock("../../../server/utils/db-helpers", () => ({
  loadOwnedOrThrow: mockLoadOwnedOrThrow,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({
    select: mockSelect,
    delete: mockDelete,
  }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual };
});

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getRouterParam: mockGetRouterParam,
});

const { default: handler } = await import("@trips-id-stopid.delete");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function buildEvent() {
  return { context: { userId: "user-1" } };
}

describe("DELETE /api/trips/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockImplementation((_, key: string) =>
      key === "id" ? "trip-1" : "stop-1",
    );
    mockLoadOwnedOrThrow.mockResolvedValue({ id: "trip-1" });
    mockSelectLimit.mockResolvedValue([{ id: "stop-1", tripId: "trip-1" }]);
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
    mockFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("deletes the stop and returns ok", async () => {
    const result = await (handler as (event: object) => Promise<unknown>)(
      buildEvent(),
    );

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("throws 400 when trip id is missing", async () => {
    mockGetRouterParam.mockImplementation((_, key: string) =>
      key === "id" ? undefined : "stop-1",
    );

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when stop id is missing", async () => {
    mockGetRouterParam.mockImplementation((_, key: string) =>
      key === "id" ? "trip-1" : undefined,
    );

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the trip is not owned by the user", async () => {
    mockLoadOwnedOrThrow.mockRejectedValue(
      Object.assign(new Error("Not found"), { statusCode: 404 }),
    );

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when the stop does not belong to the trip", async () => {
    mockSelectLimit.mockResolvedValue([]);

    await expect(
      (handler as (event: object) => Promise<unknown>)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
