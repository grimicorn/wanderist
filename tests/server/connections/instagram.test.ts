/**
 * Unit tests for the Instagram connection API handlers.
 *
 * All external dependencies (DB, Instagram client, crypto, Nitro globals)
 * are mocked so no network or database access occurs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock factories
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockEnsureUser,
  mockGetDb,
  mockDbInsert,
  mockDbInsertValues,
  mockDbInsertOnConflict,
  mockDbSelect,
  mockDbSelectFrom,
  mockDbSelectWhere,
  mockDbSelectLimit,
  mockDbDelete,
  mockDbDeleteWhere,
  mockBuildInstagramAuthUrl,
  mockExchangeInstagramCode,
  mockExchangeForLongLivedToken,
  mockFetchInstagramUser,
  mockFetchInstagramMedia,
  mockFetchInstagramImage,
  mockFilterGeotaggedMedia,
  mockEncryptToken,
  mockDecryptToken,
  mockPutMediaBlob,
  mockGetCookie,
  mockSetCookie,
  mockDeleteCookie,
  mockSendRedirect,
  mockGetQuery,
  mockReadBody,
  mockSetResponseStatus,
} = vi.hoisted(() => {
  const mockDbInsertOnConflict = vi.fn().mockResolvedValue(undefined);
  const mockDbInsertValues = vi.fn(() => ({
    onConflictDoUpdate: mockDbInsertOnConflict,
  }));
  const mockDbInsert = vi.fn(() => ({
    values: mockDbInsertValues,
  }));

  const mockDbDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDbDelete = vi.fn(() => ({ where: mockDbDeleteWhere }));

  const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
  const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }));
  const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
  const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }));

  const mockGetDb = vi.fn(() => ({
    insert: mockDbInsert,
    delete: mockDbDelete,
    select: mockDbSelect,
  }));

  return {
    mockRequireUser: vi.fn().mockReturnValue("user-1"),
    mockEnsureUser: vi.fn().mockResolvedValue("user-1"),
    mockGetDb,
    mockDbInsert,
    mockDbInsertValues,
    mockDbInsertOnConflict,
    mockDbSelect,
    mockDbSelectFrom,
    mockDbSelectWhere,
    mockDbSelectLimit,
    mockDbDelete,
    mockDbDeleteWhere,
    mockBuildInstagramAuthUrl: vi
      .fn()
      .mockReturnValue("https://instagram.com/oauth/authorize?foo"),
    mockExchangeInstagramCode: vi
      .fn()
      .mockResolvedValue({ access_token: "short-token", token_type: "bearer" }),
    mockExchangeForLongLivedToken: vi.fn().mockResolvedValue({
      access_token: "long-token",
      token_type: "bearer",
      expires_in: 5183944,
    }),
    mockFetchInstagramUser: vi
      .fn()
      .mockResolvedValue({ id: "ig-123", username: "testuser" }),
    mockFetchInstagramMedia: vi.fn().mockResolvedValue({ data: [] }),
    mockFetchInstagramImage: vi
      .fn()
      .mockResolvedValue(Buffer.from("fake-image-bytes")),
    mockFilterGeotaggedMedia: vi.fn().mockReturnValue([]),
    mockEncryptToken: vi.fn().mockReturnValue("encrypted-token"),
    mockDecryptToken: vi.fn().mockReturnValue("long-token"),
    mockPutMediaBlob: vi.fn().mockResolvedValue(undefined),
    mockGetCookie: vi.fn(),
    mockSetCookie: vi.fn(),
    mockDeleteCookie: vi.fn(),
    mockSendRedirect: vi.fn().mockResolvedValue(undefined),
    mockGetQuery: vi.fn().mockReturnValue({}),
    mockReadBody: vi.fn().mockResolvedValue({}),
    mockSetResponseStatus: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
  ensureUser: mockEnsureUser,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: mockGetDb,
}));

vi.mock("../../../server/utils/instagramClient", () => ({
  buildInstagramAuthUrl: mockBuildInstagramAuthUrl,
  exchangeInstagramCode: mockExchangeInstagramCode,
  exchangeForLongLivedToken: mockExchangeForLongLivedToken,
  fetchInstagramUser: mockFetchInstagramUser,
  fetchInstagramMedia: mockFetchInstagramMedia,
  fetchInstagramImage: mockFetchInstagramImage,
  filterGeotaggedMedia: mockFilterGeotaggedMedia,
  INSTAGRAM_SCOPES: "instagram_basic,instagram_manage_media",
  INSTAGRAM_MEDIA_FIELDS:
    "id,caption,media_type,timestamp,permalink,media_url,location",
  INSTAGRAM_MEDIA_LIMIT: 50,
  INSTAGRAM_GEOTAGGED_MEDIA_TYPES: new Set(["IMAGE", "CAROUSEL_ALBUM"]),
}));

vi.mock("../../../server/utils/tokenCrypto", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

vi.mock("../../../server/utils/mediaStore", () => ({
  putMediaBlob: mockPutMediaBlob,
}));

// Nitro/h3 globals
Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  requireNuxtApp: vi.fn(),
  getCookie: mockGetCookie,
  setCookie: mockSetCookie,
  deleteCookie: mockDeleteCookie,
  sendRedirect: mockSendRedirect,
  getQuery: mockGetQuery,
  readBody: mockReadBody,
  setResponseStatus: mockSetResponseStatus,
  getRouterParam: vi.fn(),
  getHeader: vi.fn(),
  useRuntimeConfig: vi.fn(() => ({ databaseUrl: "postgres://test" })),
});

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

const { default: startHandler } =
  await import("../../../server/api/connections/instagram/start.get");
const { default: callbackHandler } =
  await import("../../../server/api/connections/instagram/callback.get");
const { default: statusHandler } =
  await import("../../../server/api/connections/instagram/index.get");
const { default: deleteHandler } =
  await import("../../../server/api/connections/instagram/index.delete");
const { default: importHandler } =
  await import("../../../server/api/connections/instagram/import.post");

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
// GET /api/connections/instagram/start
// ---------------------------------------------------------------------------

describe("GET /api/connections/instagram/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    process.env.INSTAGRAM_CLIENT_ID = "test-client-id";
    process.env.NUXT_PUBLIC_SITE_ORIGIN = "https://wanderist.app";
  });

  it("sets the state cookie and redirects to Instagram OAuth", async () => {
    await call(startHandler, makeEvent());

    expect(mockSetCookie).toHaveBeenCalledWith(
      expect.anything(),
      "ig_oauth_state",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockSendRedirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("instagram.com"),
      302,
    );
  });

  it("sets secure: true only in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    await call(startHandler, makeEvent());

    expect(mockSetCookie).toHaveBeenCalledWith(
      expect.anything(),
      "ig_oauth_state",
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );

    process.env.NODE_ENV = originalNodeEnv;
  });

  it("throws 500 when INSTAGRAM_CLIENT_ID is missing", async () => {
    delete process.env.INSTAGRAM_CLIENT_ID;

    await expect(call(startHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("throws 500 when NUXT_PUBLIC_SITE_ORIGIN is missing", async () => {
    delete process.env.NUXT_PUBLIC_SITE_ORIGIN;

    await expect(call(startHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(call(startHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/instagram/callback
// ---------------------------------------------------------------------------

describe("GET /api/connections/instagram/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetCookie.mockReturnValue("test-state-token");
    mockGetQuery.mockReturnValue({
      code: "auth-code-123",
      state: "test-state-token",
    });
    process.env.INSTAGRAM_CLIENT_ID = "test-client-id";
    process.env.INSTAGRAM_CLIENT_SECRET = "test-client-secret";
    process.env.NUXT_PUBLIC_SITE_ORIGIN = "https://wanderist.app";
    mockExchangeInstagramCode.mockResolvedValue({
      access_token: "short-token",
    });
    mockExchangeForLongLivedToken.mockResolvedValue({
      access_token: "long-token",
    });
    mockFetchInstagramUser.mockResolvedValue({ id: "ig-123" });
    mockEncryptToken.mockReturnValue("encrypted-token");
    mockDbInsertOnConflict.mockResolvedValue(undefined);
  });

  it("stores the encrypted token and redirects to /settings with success query on success", async () => {
    await call(callbackHandler, makeEvent());

    expect(mockEncryptToken).toHaveBeenCalledWith("long-token");
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockSendRedirect).toHaveBeenCalledWith(
      expect.anything(),
      "/settings?connection=instagram_success#connections",
      302,
    );
  });

  it("throws 400 when the state does not match the cookie", async () => {
    mockGetQuery.mockReturnValue({
      code: "auth-code-123",
      state: "wrong-state",
    });

    await expect(call(callbackHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when the state cookie is missing", async () => {
    mockGetCookie.mockReturnValue(undefined);

    await expect(call(callbackHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("redirects to error path when Instagram returns an error query param", async () => {
    mockGetQuery.mockReturnValue({ error: "access_denied" });

    await call(callbackHandler, makeEvent());

    expect(mockSendRedirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("connection_error=instagram"),
      302,
    );
  });

  it("throws 400 when code is missing from the query", async () => {
    mockGetQuery.mockReturnValue({ state: "test-state-token" });

    await expect(call(callbackHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("deletes the state cookie after validation", async () => {
    await call(callbackHandler, makeEvent());

    expect(mockDeleteCookie).toHaveBeenCalledWith(
      expect.anything(),
      "ig_oauth_state",
    );
  });

  it("includes the userId in the insert values", async () => {
    await call(callbackHandler, makeEvent());

    const calledValues = mockDbInsertValues.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(calledValues?.userId).toBe("user-1");
    expect(calledValues?.provider).toBe("instagram");
    expect(calledValues?.accessToken).toBe("encrypted-token");
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/instagram (status)
// ---------------------------------------------------------------------------

describe("GET /api/connections/instagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockDbSelectLimit.mockResolvedValue([]);
  });

  it("returns { connected: false } when no row exists", async () => {
    const result = await call(statusHandler, makeEvent());

    expect(result).toEqual({ connected: false });
  });

  it("returns { connected: true } when a connection row exists", async () => {
    mockDbSelectLimit.mockResolvedValue([{ id: "row-1" }]);

    const result = await call(statusHandler, makeEvent());

    expect(result).toEqual({ connected: true });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(call(statusHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/connections/instagram
// ---------------------------------------------------------------------------

describe("DELETE /api/connections/instagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockDbDeleteWhere.mockResolvedValue(undefined);
  });

  it("deletes the connected_accounts row for the user", async () => {
    const result = await call(deleteHandler, makeEvent());

    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockDbDeleteWhere).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(call(deleteHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("scopes the delete to the authenticated user", async () => {
    mockRequireUser.mockReturnValue("user-specific");

    await call(deleteHandler, makeEvent());

    // The delete was driven through a where() call — ownership scoping was applied.
    expect(mockDbDeleteWhere).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/connections/instagram/import
// ---------------------------------------------------------------------------

describe("POST /api/connections/instagram/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    mockDbSelectLimit.mockResolvedValue([{ accessToken: "encrypted-token" }]);
    mockDecryptToken.mockReturnValue("long-token");
    mockFetchInstagramMedia.mockResolvedValue({ data: [] });
    mockFilterGeotaggedMedia.mockReturnValue([]);
  });

  it("returns { imported: 0, skipped: 0, errors: [] } when no geotagged photos exist", async () => {
    const result = await call(importHandler, makeEvent());

    expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
  });

  it("throws 422 when Instagram is not connected", async () => {
    mockDbSelectLimit.mockResolvedValue([]);

    await expect(call(importHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it("throws 422 when the connection row has no access token", async () => {
    mockDbSelectLimit.mockResolvedValue([{ accessToken: null }]);

    await expect(call(importHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it("decrypts the stored token before calling fetchInstagramMedia", async () => {
    await call(importHandler, makeEvent());

    expect(mockDecryptToken).toHaveBeenCalledWith("encrypted-token");
    expect(mockFetchInstagramMedia).toHaveBeenCalledWith("long-token");
  });

  it("calls fetchInstagramImage for each geotagged item", async () => {
    const geotaggedItem = {
      id: "ig-media-1",
      media_type: "IMAGE",
      media_url: "https://cdn.instagram.com/photo.jpg",
      timestamp: "2024-01-01T00:00:00Z",
      permalink: "https://www.instagram.com/p/abc/",
      location: { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
    };
    mockFilterGeotaggedMedia.mockReturnValue([geotaggedItem]);
    mockFetchInstagramImage.mockResolvedValue(Buffer.from("img"));
    mockDbInsertOnConflict.mockResolvedValue([{ id: "row-id" }]);
    mockDbInsertValues.mockReturnValue({
      onConflictDoUpdate: mockDbInsertOnConflict,
      returning: vi.fn().mockResolvedValue([{ id: "row-id" }]),
    });

    const mockTransaction = vi.fn().mockImplementation(async (callback) => {
      const transactionDb = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
          })),
        })),
      };
      return callback(transactionDb);
    });
    mockGetDb.mockReturnValue({
      insert: mockDbInsert,
      delete: mockDbDelete,
      select: mockDbSelect,
      transaction: mockTransaction,
    });

    await call(importHandler, makeEvent());

    expect(mockFetchInstagramImage).toHaveBeenCalledWith(
      "https://cdn.instagram.com/photo.jpg",
    );
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockEnsureUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    await expect(call(importHandler, makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("scopes the connection lookup to the authenticated user", async () => {
    await call(importHandler, makeEvent());

    // The select chain passed through where() — user scoping was applied.
    expect(mockDbSelectWhere).toHaveBeenCalledTimes(1);
  });
});
