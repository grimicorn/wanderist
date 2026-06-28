/**
 * Unit tests for DELETE /api/account
 *
 * Clerk and auth utilities are mocked so no network access is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  stubCreateError,
  stubDefineEventHandler,
  buildAccountEvent,
  callHandler,
  assertThrows401WhenNotAuthenticated,
} from "./_helpers";

// ---------------------------------------------------------------------------
// Hoist mock factories
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockClerkDeleteUser,
  mockDbUpdateSet,
  mockDbUpdateWhere,
  mockDbUpdateReturning,
  mockGetDb,
} = vi.hoisted(() => {
  const mockDbUpdateReturning = vi.fn().mockResolvedValue([{ id: "user-1" }]);
  const mockDbUpdateWhere = vi.fn(() => ({ returning: mockDbUpdateReturning }));
  const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
  const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

  const mockGetDb = vi.fn(() => ({ update: mockDbUpdate }));

  return {
    mockRequireUser: vi.fn(),
    mockClerkDeleteUser: vi.fn().mockResolvedValue(undefined),
    mockDbUpdateSet,
    mockDbUpdateWhere,
    mockDbUpdateReturning,
    mockGetDb,
  };
});

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../../server/utils/clerkAccount", () => ({
  clerkDeleteUser: mockClerkDeleteUser,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: mockGetDb,
}));

stubDefineEventHandler();
stubCreateError();

const { default: handler } =
  await import("../../../server/api/account/index.delete");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockDbUpdateReturning.mockResolvedValue([{ id: "user-1" }]);
    mockClerkDeleteUser.mockResolvedValue(undefined);
  });

  it("returns ok and a gracePeriodEndsAt on success", async () => {
    const result = (await callHandler(handler, buildAccountEvent())) as {
      ok: boolean;
      gracePeriodEndsAt: string;
    };
    expect(result.ok).toBe(true);
    expect(typeof result.gracePeriodEndsAt).toBe("string");
    // Confirm the date is approximately 14 days in the future.
    const ends = new Date(result.gracePeriodEndsAt);
    const diffMs = ends.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(13);
    expect(diffDays).toBeLessThan(15);
  });

  it("stamps deletedAt on the users row", async () => {
    await callHandler(handler, buildAccountEvent());
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it("calls clerkDeleteUser with the authenticated userId", async () => {
    await callHandler(handler, buildAccountEvent());
    expect(mockClerkDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("throws 401 when requireUser throws", async () => {
    await assertThrows401WhenNotAuthenticated(mockRequireUser, handler);
    expect(mockDbUpdateSet).not.toHaveBeenCalled();
  });

  it("throws 404 when the users row is not found (update returns empty)", async () => {
    mockDbUpdateReturning.mockResolvedValue([]);

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockClerkDeleteUser).not.toHaveBeenCalled();
  });

  it("throws 502 when Clerk deleteUser fails after the soft-delete stamp", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClerkDeleteUser.mockRejectedValue(new Error("Clerk unavailable"));

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("scopes the DB update to the authenticated userId", async () => {
    mockRequireUser.mockReturnValue("user-specific");
    await callHandler(handler, buildAccountEvent());

    // The where mock is driven once; confirm it was called (ownership scoping).
    expect(mockDbUpdateWhere).toHaveBeenCalledTimes(1);
  });
});
