/**
 * Unit tests for server/utils/refreshInstagramTokens.ts — the scheduled
 * batch that refreshes Instagram long-lived tokens nearing expiry.
 *
 * The Instagram client and token crypto are mocked at their module
 * boundaries; the drizzle db is a mocked select/update chain — no network or
 * database access. Same isolation pattern as
 * tests/server/purge-accounts.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRefreshLongLivedToken, mockEncryptToken, mockDecryptToken } =
  vi.hoisted(() => ({
    mockRefreshLongLivedToken: vi.fn(),
    mockEncryptToken: vi.fn((plaintext: string) => `encrypted:${plaintext}`),
    mockDecryptToken: vi.fn((ciphertext: string) =>
      ciphertext.replace(/^encrypted:/, ""),
    ),
  }));

vi.mock("../../server/utils/instagramClient", () => ({
  refreshLongLivedToken: mockRefreshLongLivedToken,
}));

vi.mock("../../server/utils/tokenCrypto", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

const { refreshExpiringInstagramTokens } =
  await import("../../server/utils/refreshInstagramTokens");

interface DueAccount {
  userId: string;
  accessToken: string | null;
}

function makeDb(dueAccounts: DueAccount[]) {
  const selectWhere = vi.fn().mockResolvedValue(dueAccounts);
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return {
    db: { select, update } as unknown as Parameters<
      typeof refreshExpiringInstagramTokens
    >[0],
    select,
    selectWhere,
    update,
  };
}

describe("refreshExpiringInstagramTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshLongLivedToken.mockResolvedValue({
      access_token: "new-token",
      token_type: "bearer",
      expires_in: 5_183_944,
    });
  });

  it("refreshes every due account and reports their ids", async () => {
    const { db, update } = makeDb([
      { userId: "user-1", accessToken: "encrypted:t1" },
      { userId: "user-2", accessToken: "encrypted:t2" },
    ]);

    const result = await refreshExpiringInstagramTokens(db);

    expect(mockRefreshLongLivedToken).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      refreshedUserIds: ["user-1", "user-2"],
      refreshedCount: 2,
      failures: [],
    });
  });

  it("reports zero when no account is due", async () => {
    const { db, update } = makeDb([]);

    const result = await refreshExpiringInstagramTokens(db);

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({
      refreshedUserIds: [],
      refreshedCount: 0,
      failures: [],
    });
  });

  it("collects a per-account failure and keeps going with the rest", async () => {
    const { db } = makeDb([
      { userId: "user-ok", accessToken: "encrypted:ok" },
      { userId: "user-bad", accessToken: "encrypted:bad" },
    ]);
    mockRefreshLongLivedToken
      .mockResolvedValueOnce({
        access_token: "new-token",
        token_type: "bearer",
        expires_in: 5_183_944,
      })
      .mockRejectedValueOnce(new Error("400 token revoked"));

    const result = await refreshExpiringInstagramTokens(db);

    expect(result.refreshedUserIds).toEqual(["user-ok"]);
    expect(result.refreshedCount).toBe(1);
    expect(result.failures).toEqual([
      { userId: "user-bad", error: "400 token revoked" },
    ]);
  });

  it("records a failure without calling the API when a row has no token", async () => {
    const { db } = makeDb([{ userId: "user-empty", accessToken: null }]);

    const result = await refreshExpiringInstagramTokens(db);

    expect(mockRefreshLongLivedToken).not.toHaveBeenCalled();
    expect(result.failures).toEqual([
      { userId: "user-empty", error: "No stored token" },
    ]);
    expect(result.refreshedCount).toBe(0);
  });
});
