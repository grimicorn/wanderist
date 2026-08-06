/**
 * Unit tests for netlify/functions/refresh-instagram-tokens.mts — the thin
 * adapter that wires server/utils/refreshInstagramTokens.ts to a real DB
 * connection and to Netlify's scheduled-function invocation.
 *
 * createDb and refreshExpiringInstagramTokens are mocked so no network or
 * database access is needed. Same pattern as
 * tests/netlify-functions/purge-deleted-accounts.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateDb, mockRefreshExpiringInstagramTokens } = vi.hoisted(() => ({
  mockCreateDb: vi.fn(() => ({ select: vi.fn(), update: vi.fn() })),
  mockRefreshExpiringInstagramTokens: vi.fn(),
}));

vi.mock("../../server/db/index", () => ({
  createDb: mockCreateDb,
}));

vi.mock("../../server/utils/refreshInstagramTokens", () => ({
  refreshExpiringInstagramTokens: mockRefreshExpiringInstagramTokens,
}));

const { handler } =
  await import("../../netlify/functions/refresh-instagram-tokens.mts");

describe("refresh-instagram-tokens scheduled function", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/db";
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
  });

  it("builds a DB client from DATABASE_URL and returns 200 with the refresh result", async () => {
    const result = {
      refreshedUserIds: ["user-1"],
      refreshedCount: 1,
      failures: [],
      capReached: false,
    };
    mockRefreshExpiringInstagramTokens.mockResolvedValue(result);

    const response = await handler();

    expect(mockCreateDb).toHaveBeenCalledWith("postgres://test/db");
    expect(mockRefreshExpiringInstagramTokens).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(result);
  });

  it("throws before touching the DB when TOKEN_ENCRYPTION_KEY is unset", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.TOKEN_ENCRYPTION_KEY;

    await expect(handler()).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(mockCreateDb).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("still returns 200 when some accounts fail but at least one succeeded", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockResolvedValue({
      refreshedUserIds: ["user-1"],
      refreshedCount: 1,
      failures: [
        { userId: "user-2", error: "400 revoked", unrecoverable: true },
      ],
      capReached: false,
    });

    const response = await handler();

    expect(response.statusCode).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("throws when nothing succeeded and a recoverable failure occurred", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockResolvedValue({
      refreshedUserIds: [],
      refreshedCount: 0,
      failures: [{ userId: "user-1", error: "500", unrecoverable: false }],
      capReached: false,
    });

    await expect(handler()).rejects.toThrow(/recoverable refresh failure/);
    consoleSpy.mockRestore();
  });

  it("does not throw when the only failures are revoked (unrecoverable) accounts", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockResolvedValue({
      refreshedUserIds: [],
      refreshedCount: 0,
      failures: [
        { userId: "user-1", error: "400 revoked", unrecoverable: true },
        { userId: "user-2", error: "401 revoked", unrecoverable: true },
      ],
      capReached: false,
    });

    const response = await handler();

    expect(response.statusCode).toBe(200);
    consoleSpy.mockRestore();
  });

  it("logs and re-throws when the refresh run fails, so Netlify records it as failed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockRejectedValue(
      new Error("DB unreachable"),
    );

    await expect(handler()).rejects.toThrow("DB unreachable");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
