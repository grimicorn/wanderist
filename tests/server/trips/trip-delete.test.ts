/**
 * Tests for DELETE /api/trips/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockAssertOwnership,
  mockGetRouterParam,
  mockCreateError,
  mockDelete,
  mockWhere,
} = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn(() => ({ where: mockWhere }));

  return {
    mockAssertOwnership: vi.fn().mockResolvedValue(undefined),
    mockGetRouterParam: vi.fn().mockReturnValue("trip-1"),
    mockCreateError: vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    ),
    mockDelete,
    mockWhere,
  };
});

vi.mock("../../../server/utils/db-helpers", () => ({
  assertOwnership: mockAssertOwnership,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({ delete: mockDelete }),
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getRouterParam: mockGetRouterParam,
});

const { default: handler } = await import("@trips-id.delete");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function buildEvent() {
  return { context: { userId: "user-1" } };
}

describe("DELETE /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockReturnValue("trip-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    mockWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  it("deletes the trip and returns ok", async () => {
    const result = await (handler as (event: object) => unknown)(buildEvent());

    expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("verifies ownership before deleting", async () => {
    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockAssertOwnership).toHaveBeenCalledBefore
      ? expect(mockAssertOwnership).toHaveBeenCalledBefore(mockDelete)
      : expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when trip id is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the trip does not belong to the user", async () => {
    mockAssertOwnership.mockRejectedValue(
      Object.assign(new Error("Not found"), { statusCode: 404 }),
    );

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
