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

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/db";
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
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

  it("still returns 200 when some accounts fail, logging the failures", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockResolvedValue({
      refreshedUserIds: ["user-1"],
      refreshedCount: 1,
      failures: [{ userId: "user-2", error: "400 revoked" }],
      capReached: false,
    });

    const response = await handler();

    expect(response.statusCode).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("throws when every attempted account failed, so a systemic failure is recorded", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRefreshExpiringInstagramTokens.mockResolvedValue({
      refreshedUserIds: [],
      refreshedCount: 0,
      failures: [
        { userId: "user-1", error: "400 revoked" },
        { userId: "user-2", error: "400 revoked" },
      ],
      capReached: false,
    });

    await expect(handler()).rejects.toThrow(/all 2 refresh/);
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
