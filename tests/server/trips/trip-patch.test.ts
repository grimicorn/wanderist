/**
 * Tests for PATCH /api/trips/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeOwnershipError, callHandler } from "./_helpers";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoadOwnedOrThrow,
  mockGetRouterParam,
  mockReadBody,
  mockCreateError,
  mockUpdate,
  mockSet,
  mockWhere,
  mockReturning,
} = vi.hoisted(() => {
  const UPDATED_TRIP = {
    id: "trip-1",
    userId: "user-1",
    name: "Updated Name",
    status: "ongoing",
    visibility: "private",
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockReturning = vi.fn().mockResolvedValue([UPDATED_TRIP]);
  const mockWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockLoadOwnedOrThrow = vi.fn().mockResolvedValue({
    id: "trip-1",
    userId: "user-1",
    name: "Original",
  });

  return {
    mockLoadOwnedOrThrow,
    mockGetRouterParam: vi.fn().mockReturnValue("trip-1"),
    mockReadBody: vi.fn().mockResolvedValue({ name: "Updated Name" }),
    mockCreateError: vi.fn(
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    ),
    mockUpdate,
    mockSet,
    mockWhere,
    mockReturning,
  };
});

vi.mock("../../../server/utils/db-helpers", () => ({
  loadOwnedOrThrow: mockLoadOwnedOrThrow,
  optionalString: vi.fn((value: unknown) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "string") {
      throw Object.assign(new Error("must be a string"), { statusCode: 400 });
    }

    return value;
  }),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({ update: mockUpdate }),
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getRouterParam: mockGetRouterParam,
  readBody: mockReadBody,
});

const { default: handler } = await import("@trips-id.patch");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function buildEvent() {
  return { context: { userId: "user-1" } };
}

const UPDATED_TRIP = {
  id: "trip-1",
  userId: "user-1",
  name: "Updated Name",
  status: "ongoing",
  visibility: "private",
  startDate: null,
  endDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("PATCH /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockReturnValue("trip-1");
    mockLoadOwnedOrThrow.mockResolvedValue({ id: "trip-1", userId: "user-1" });
    mockReadBody.mockResolvedValue({ name: "Updated Name" });
    mockReturning.mockResolvedValue([UPDATED_TRIP]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  it("updates and returns the trip", async () => {
    const result = await callHandler(handler, buildEvent());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated Name" }),
    );
    expect(result).toMatchObject({ name: "Updated Name" });
  });

  it("verifies ownership before updating", async () => {
    await callHandler(handler, buildEvent());

    const ownershipOrder = mockLoadOwnedOrThrow.mock.invocationCallOrder[0];
    const updateOrder = mockUpdate.mock.invocationCallOrder[0];
    expect(ownershipOrder).toBeLessThan(updateOrder);
  });

  it("throws 400 when no valid fields are provided", async () => {
    mockReadBody.mockResolvedValue({});

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 for an invalid status value", async () => {
    mockReadBody.mockResolvedValue({ status: "bad-status" });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 for an invalid visibility value", async () => {
    mockReadBody.mockResolvedValue({ visibility: "secret" });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 for an invalid date string", async () => {
    mockReadBody.mockResolvedValue({ startDate: "not-a-date" });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when trip id is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when the trip does not belong to the user", async () => {
    mockLoadOwnedOrThrow.mockRejectedValue(makeOwnershipError());

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("accepts null dates to clear start/end date", async () => {
    mockReadBody.mockResolvedValue({ startDate: null });
    mockReturning.mockResolvedValue([{ ...UPDATED_TRIP, startDate: null }]);

    await callHandler(handler, buildEvent());

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: null }),
    );
  });

  it("throws 400 when endDate is before startDate (both in patch)", async () => {
    mockReadBody.mockResolvedValue({
      startDate: "2026-07-10T00:00:00.000Z",
      endDate: "2026-07-01T00:00:00.000Z",
    });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when patching only endDate earlier than existing startDate", async () => {
    mockLoadOwnedOrThrow.mockResolvedValue({
      id: "trip-1",
      userId: "user-1",
      startDate: new Date("2026-07-10T00:00:00.000Z"),
    });
    mockReadBody.mockResolvedValue({ endDate: "2026-07-01T00:00:00.000Z" });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when patching only startDate later than existing endDate", async () => {
    mockLoadOwnedOrThrow.mockResolvedValue({
      id: "trip-1",
      userId: "user-1",
      endDate: new Date("2026-07-01T00:00:00.000Z"),
    });
    mockReadBody.mockResolvedValue({ startDate: "2026-07-10T00:00:00.000Z" });

    await expect(callHandler(handler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
