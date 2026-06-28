/**
 * Unit tests for the Google connection API handlers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock factories
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockGetClerkClient,
  mockFetchGoogleConnectionInfo,
  mockDisconnectGoogleAccount,
  mockReadBody,
} = vi.hoisted(() => ({
  mockRequireUser: vi.fn().mockReturnValue("user-1"),
  mockGetClerkClient: vi.fn().mockReturnValue({}),
  mockFetchGoogleConnectionInfo: vi.fn().mockResolvedValue({
    connected: true,
    emailAddress: "user@gmail.com",
    identificationId: "idn_abc123",
  }),
  mockDisconnectGoogleAccount: vi.fn().mockResolvedValue(undefined),
  mockReadBody: vi.fn().mockResolvedValue({ identificationId: "idn_abc123" }),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
  ensureUser: mockRequireUser,
}));

vi.mock("../../../server/utils/clerk", () => ({
  getClerkClient: mockGetClerkClient,
}));

vi.mock("../../../server/utils/googleClient", () => ({
  fetchGoogleConnectionInfo: mockFetchGoogleConnectionInfo,
  disconnectGoogleAccount: mockDisconnectGoogleAccount,
  GOOGLE_PROVIDER_ID: "google",
}));

// Nitro/h3 globals
Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  readBody: mockReadBody,
  useRuntimeConfig: vi.fn(() => ({ databaseUrl: "postgres://test" })),
});

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

const { default: getHandler } =
  await import("../../../server/api/connections/google/index.get");
const { default: deleteHandler } =
  await import("../../../server/api/connections/google/index.delete");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Handler = (event: unknown) => Promise<unknown>;

function call(handler: unknown, event: unknown): Promise<unknown> {
  return (handler as Handler)(event);
}

function makeEvent(): object {
  return { context: { userId: "user-1" } };
}

// ---------------------------------------------------------------------------
// GET /api/connections/google
// ---------------------------------------------------------------------------

describe("GET /api/connections/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockFetchGoogleConnectionInfo.mockResolvedValue({
      connected: true,
      emailAddress: "user@gmail.com",
      identificationId: "idn_abc123",
    });
  });

  it("returns the Google connection info from Clerk", async () => {
    const result = await call(getHandler, makeEvent());

    expect(result).toEqual({
      connected: true,
      emailAddress: "user@gmail.com",
      identificationId: "idn_abc123",
    });
  });

  it("returns connected: false when no Google account is linked", async () => {
    mockFetchGoogleConnectionInfo.mockResolvedValue({
      connected: false,
      emailAddress: null,
      identificationId: null,
    });

    const result = (await call(getHandler, makeEvent())) as Record<
      string,
      unknown
    >;

    expect(result.connected).toBe(false);
    expect(result.emailAddress).toBeNull();
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(call(getHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("passes the authenticated userId to fetchGoogleConnectionInfo", async () => {
    mockRequireUser.mockReturnValue("user-xyz");

    await call(getHandler, makeEvent());

    expect(mockFetchGoogleConnectionInfo).toHaveBeenCalledWith(
      expect.anything(),
      "user-xyz",
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/connections/google
// ---------------------------------------------------------------------------

describe("DELETE /api/connections/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockReadBody.mockResolvedValue({ identificationId: "idn_abc123" });
    mockFetchGoogleConnectionInfo.mockResolvedValue({
      connected: true,
      emailAddress: "user@gmail.com",
      identificationId: "idn_abc123",
    });
    process.env.NUXT_CLERK_SECRET_KEY = "sk_test_secret";
  });

  it("disconnects the Google account and returns ok", async () => {
    const result = await call(deleteHandler, makeEvent());

    expect(mockDisconnectGoogleAccount).toHaveBeenCalledWith(
      "sk_test_secret",
      "user-1",
      "idn_abc123",
    );
    expect(result).toEqual({ ok: true });
  });

  it("throws 400 when identificationId is missing from the body", async () => {
    mockReadBody.mockResolvedValue({});

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when identificationId is not a string", async () => {
    mockReadBody.mockResolvedValue({ identificationId: 42 });

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when the identificationId does not match the Clerk record", async () => {
    mockFetchGoogleConnectionInfo.mockResolvedValue({
      connected: true,
      emailAddress: "user@gmail.com",
      identificationId: "idn_different",
    });

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 404 when Google is not connected for this user", async () => {
    mockFetchGoogleConnectionInfo.mockResolvedValue({
      connected: false,
      emailAddress: null,
      identificationId: null,
    });

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
