/**
 * Unit tests for server/utils/instagramToken.ts — the Instagram long-lived
 * token refresh + on-use "self-heal" boundary.
 *
 * The pure predicates are tested directly. ensureFreshInstagramToken and
 * persistRefreshedInstagramToken are exercised against a mocked drizzle db
 * chain, with the Instagram client and token crypto mocked at their module
 * boundaries — no network or database access. Same pattern as
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

const {
  INSTAGRAM_REFRESH_THRESHOLD_DAYS,
  isInstagramTokenNearExpiry,
  isInstagramTokenExpired,
  expiryFromResponse,
  persistRefreshedInstagramToken,
  ensureFreshInstagramToken,
} = await import("../../server/utils/instagramToken");
import { MS_PER_DAY } from "../../server/utils/accountLifecycle";
import { connectedAccounts } from "../../server/db/schema";

// ---------------------------------------------------------------------------
// Pure predicates
// ---------------------------------------------------------------------------

describe("isInstagramTokenNearExpiry", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  it("is true when the token expires within the threshold window", () => {
    const expiresAt = new Date(
      now.getTime() + (INSTAGRAM_REFRESH_THRESHOLD_DAYS - 1) * MS_PER_DAY,
    );
    expect(isInstagramTokenNearExpiry(expiresAt, now)).toBe(true);
  });

  it("is false when the token has more than the threshold left", () => {
    const expiresAt = new Date(
      now.getTime() + (INSTAGRAM_REFRESH_THRESHOLD_DAYS + 1) * MS_PER_DAY,
    );
    expect(isInstagramTokenNearExpiry(expiresAt, now)).toBe(false);
  });

  it("is true for a null expiry so the next use backfills one", () => {
    expect(isInstagramTokenNearExpiry(null, now)).toBe(true);
  });
});

describe("isInstagramTokenExpired", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  it("is true once the expiry is at or before now", () => {
    expect(isInstagramTokenExpired(new Date(now.getTime() - 1), now)).toBe(
      true,
    );
  });

  it("is false while the expiry is still in the future", () => {
    expect(
      isInstagramTokenExpired(new Date(now.getTime() + MS_PER_DAY), now),
    ).toBe(false);
  });

  it("is false for a null expiry — unknown is not treated as dead", () => {
    expect(isInstagramTokenExpired(null, now)).toBe(false);
  });
});

describe("expiryFromResponse", () => {
  it("adds expires_in seconds to now", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const expiry = expiryFromResponse(
      { access_token: "t", token_type: "bearer", expires_in: 3600 },
      now,
    );
    expect(expiry.getTime()).toBe(now.getTime() + 3600 * 1000);
  });
});

// ---------------------------------------------------------------------------
// DB-touching helpers — mocked drizzle chain
// ---------------------------------------------------------------------------

function makeUpdatableDb() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return {
    db: { update } as unknown as Parameters<
      typeof persistRefreshedInstagramToken
    >[0],
    update,
    set,
    where,
  };
}

describe("persistRefreshedInstagramToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the encrypted new token + derived expiry scoped to the user", async () => {
    const { db, update, set, where } = makeUpdatableDb();
    const now = new Date("2026-08-01T00:00:00.000Z");

    const expiresAt = await persistRefreshedInstagramToken(
      db,
      "user-1",
      { access_token: "fresh-token", token_type: "bearer", expires_in: 5000 },
      now,
    );

    expect(update).toHaveBeenCalledWith(connectedAccounts);
    expect(set).toHaveBeenCalledWith({
      accessToken: "encrypted:fresh-token",
      expiresAt: new Date(now.getTime() + 5000 * 1000),
    });
    expect(where).toHaveBeenCalledTimes(1);
    expect(expiresAt).toEqual(new Date(now.getTime() + 5000 * 1000));
  });
});

describe("ensureFreshInstagramToken", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current token without refreshing when not near expiry", async () => {
    const { db, update } = makeUpdatableDb();
    const expiresAt = new Date(
      now.getTime() + (INSTAGRAM_REFRESH_THRESHOLD_DAYS + 5) * MS_PER_DAY,
    );

    const token = await ensureFreshInstagramToken(
      db,
      "user-1",
      { accessToken: "encrypted:current-token", expiresAt },
      now,
    );

    expect(token).toBe("current-token");
    expect(mockRefreshLongLivedToken).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("refreshes, persists, and returns the new token when near expiry", async () => {
    const { db, update } = makeUpdatableDb();
    const expiresAt = new Date(
      now.getTime() + (INSTAGRAM_REFRESH_THRESHOLD_DAYS - 1) * MS_PER_DAY,
    );
    mockRefreshLongLivedToken.mockResolvedValue({
      access_token: "new-token",
      token_type: "bearer",
      expires_in: 5_183_944,
    });

    const token = await ensureFreshInstagramToken(
      db,
      "user-1",
      { accessToken: "encrypted:old-token", expiresAt },
      now,
    );

    expect(mockRefreshLongLivedToken).toHaveBeenCalledWith({
      accessToken: "old-token",
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(token).toBe("new-token");
  });

  it("refreshes a null-expiry (pre-refresh) row to backfill its expiry", async () => {
    const { db, update } = makeUpdatableDb();
    mockRefreshLongLivedToken.mockResolvedValue({
      access_token: "new-token",
      token_type: "bearer",
      expires_in: 5_183_944,
    });

    const token = await ensureFreshInstagramToken(
      db,
      "user-1",
      { accessToken: "encrypted:old-token", expiresAt: null },
      now,
    );

    expect(mockRefreshLongLivedToken).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(token).toBe("new-token");
  });

  it("falls back to the current token when refresh fails but it has not expired", async () => {
    const { db, update } = makeUpdatableDb();
    const expiresAt = new Date(now.getTime() + 2 * MS_PER_DAY);
    mockRefreshLongLivedToken.mockRejectedValue(new Error("429 rate limited"));

    const token = await ensureFreshInstagramToken(
      db,
      "user-1",
      { accessToken: "encrypted:still-valid", expiresAt },
      now,
    );

    expect(token).toBe("still-valid");
    expect(update).not.toHaveBeenCalled();
  });

  it("rethrows when refresh fails and the token is already expired", async () => {
    const { db } = makeUpdatableDb();
    const expiresAt = new Date(now.getTime() - MS_PER_DAY);
    mockRefreshLongLivedToken.mockRejectedValue(new Error("400 expired"));

    await expect(
      ensureFreshInstagramToken(
        db,
        "user-1",
        { accessToken: "encrypted:dead", expiresAt },
        now,
      ),
    ).rejects.toThrow("400 expired");
  });
});
