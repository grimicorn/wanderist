/**
 * Unit tests for PATCH /api/account/password
 *
 * Clerk and auth utilities are mocked so no network or Clerk credentials
 * are needed.
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
// Hoist mock factories before vi.mock() closures run.
// ---------------------------------------------------------------------------

const { mockRequireUser, mockClerkUpdatePassword, mockReadBody } = vi.hoisted(
  () => ({
    mockRequireUser: vi.fn(),
    mockClerkUpdatePassword: vi.fn().mockResolvedValue(undefined),
    mockReadBody: vi.fn(),
  }),
);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../../server/utils/clerkAccount", () => ({
  clerkUpdatePassword: mockClerkUpdatePassword,
}));

stubDefineEventHandler();
stubCreateError();
Object.assign(globalThis, { readBody: mockReadBody });

const { default: handler } =
  await import("../../../server/api/account/password.patch");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/account/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockReadBody.mockResolvedValue({ password: "validpassword123" });
    mockClerkUpdatePassword.mockResolvedValue(undefined);
  });

  it("returns ok on a valid password", async () => {
    const result = await callHandler(handler, buildAccountEvent());
    expect(result).toEqual({ ok: true });
    expect(mockClerkUpdatePassword).toHaveBeenCalledWith(
      "user-1",
      "validpassword123",
    );
  });

  it("throws 401 when requireUser throws", async () => {
    await assertThrows401WhenNotAuthenticated(mockRequireUser, handler);
    expect(mockClerkUpdatePassword).not.toHaveBeenCalled();
  });

  it("throws 400 when password is missing", async () => {
    mockReadBody.mockResolvedValue({});

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when password is too short (fewer than 8 chars)", async () => {
    mockReadBody.mockResolvedValue({ password: "short" });

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body is not an object", async () => {
    mockReadBody.mockResolvedValue("not-an-object");

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 422 and surfaces Clerk error message when Clerk rejects the password", async () => {
    mockClerkUpdatePassword.mockRejectedValue(
      Object.assign(new Error("Password too common"), { statusCode: 422 }),
    );

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "Password too common",
    });
  });

  it("calls clerkUpdatePassword with the authenticated userId", async () => {
    mockRequireUser.mockReturnValue("user-xyz");
    await callHandler(handler, buildAccountEvent());

    expect(mockClerkUpdatePassword).toHaveBeenCalledWith(
      "user-xyz",
      "validpassword123",
    );
  });
});
