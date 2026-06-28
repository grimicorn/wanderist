/**
 * Tests for DELETE /api/trips/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeOwnershipError, callHandler } from "./_helpers";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoadOwnedTrip,
  mockGetRouterParam,
  mockCreateError,
  mockDelete,
  mockWhere,
} = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn(() => ({ where: mockWhere }));

  return {
    mockLoadOwnedTrip: vi.fn().mockResolvedValue({ id: "trip-1" }),
    mockGetRouterParam: vi.fn().mockReturnValue("trip-1"),
    mockCreateError: vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    ),
    mockDelete,
    mockWhere,
  };
});

vi.mock("../../../server/utils/trip-helpers", () => ({
  requireTripId: (event: object) => {
    const id = mockGetRouterParam(event, "id");
    if (!id) {
      throw mockCreateError({
        statusCode: 400,
        statusMessage: "Trip id is required",
      });
    }
    return id;
  },
  loadOwnedTrip: mockLoadOwnedTrip,
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
    mockLoadOwnedTrip.mockResolvedValue({ id: "trip-1" });
    mockWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  it("deletes the trip and returns ok", async () => {
    const result = await callHandler(handler, buildEvent());

    expect(mockLoadOwnedTrip).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("verifies ownership before deleting", async () => {
    await callHandler(handler, buildEvent());

    const ownershipOrder = mockLoadOwnedTrip.mock.invocationCallOrder[0];
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    expect(ownershipOrder).toBeLessThan(deleteOrder);
  });

  it("throws 400 when trip id is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when the trip does not belong to the user", async () => {
    mockLoadOwnedTrip.mockRejectedValue(makeOwnershipError());

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
