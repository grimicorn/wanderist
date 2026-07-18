/**
 * Unit tests for netlify/functions/purge-deleted-accounts.mts — the thin
 * adapter that wires server/utils/purgeAccounts.ts to a real DB connection
 * and to Netlify's scheduled-function invocation.
 *
 * createDb and purgeExpiredDeletedAccounts are mocked so no network or
 * database access is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateDb, mockPurgeExpiredDeletedAccounts } = vi.hoisted(() => ({
  mockCreateDb: vi.fn(() => ({ delete: vi.fn() })),
  mockPurgeExpiredDeletedAccounts: vi.fn(),
}));

vi.mock("../../server/db/index", () => ({
  createDb: mockCreateDb,
}));

vi.mock("../../server/utils/purgeAccounts", () => ({
  purgeExpiredDeletedAccounts: mockPurgeExpiredDeletedAccounts,
}));

const { handler } =
  await import("../../netlify/functions/purge-deleted-accounts.mts");

describe("purge-deleted-accounts scheduled function", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/db";
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("builds a DB client from DATABASE_URL and returns 200 with the purge result", async () => {
    mockPurgeExpiredDeletedAccounts.mockResolvedValue({
      purgedUserIds: ["user-1", "user-2"],
      purgedCount: 2,
    });

    const response = await handler();

    expect(mockCreateDb).toHaveBeenCalledWith("postgres://test/db");
    expect(mockPurgeExpiredDeletedAccounts).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      purgedUserIds: ["user-1", "user-2"],
      purgedCount: 2,
    });
  });

  it("logs and re-throws when the purge run fails, so Netlify records the invocation as failed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPurgeExpiredDeletedAccounts.mockRejectedValue(
      new Error("DB unreachable"),
    );

    await expect(handler()).rejects.toThrow("DB unreachable");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
