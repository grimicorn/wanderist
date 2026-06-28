/**
 * Unit tests for the media API handlers.
 *
 * The Netlify Blobs store abstraction and the database are mocked so no network
 * or database access is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock factories so they are available inside vi.mock() closures, which
// Vitest hoists before any import runs.
// ---------------------------------------------------------------------------

const {
  mockEnsureUser,
  mockRequireUser,
  mockPutMediaBlob,
  mockGetMediaBlob,
  mockRemoveMediaBlob,
  mockDbInsertValues,
  mockDbInsertReturning,
  mockDbSelectFrom,
  mockDbSelectWhere,
  mockDbSelectLimit,
  mockDbDeleteWhere,
  mockGetDb,
  mockGetRouterParam,
  mockGetHeader,
  mockReadRawBody,
  mockSetResponseHeader,
  mockSetResponseStatus,
} = vi.hoisted(() => {
  const mockDbInsertReturning = vi
    .fn()
    .mockResolvedValue([{ id: "media-123", url: "user-1/media-123" }]);
  const mockDbInsertValues = vi.fn(() => ({
    returning: mockDbInsertReturning,
  }));
  const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));

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
    mockEnsureUser: vi.fn(),
    mockRequireUser: vi.fn(),
    mockPutMediaBlob: vi.fn().mockResolvedValue(undefined),
    mockGetMediaBlob: vi.fn(),
    mockRemoveMediaBlob: vi.fn().mockResolvedValue(undefined),
    mockDbInsertValues,
    mockDbInsertReturning,
    mockDbSelectFrom,
    mockDbSelectWhere,
    mockDbSelectLimit,
    mockDbDeleteWhere,
    mockGetDb,
    mockGetRouterParam: vi.fn(),
    mockGetHeader: vi.fn(),
    mockReadRawBody: vi.fn(),
    mockSetResponseHeader: vi.fn(),
    mockSetResponseStatus: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock("../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
  requireUser: mockRequireUser,
}));

vi.mock("../../server/utils/mediaStore", () => ({
  putMediaBlob: mockPutMediaBlob,
  getMediaBlob: mockGetMediaBlob,
  removeMediaBlob: mockRemoveMediaBlob,
}));

vi.mock("../../server/db/index", () => ({
  getDb: mockGetDb,
}));

// Stub Nitro/h3 auto-imports
Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  getRouterParam: mockGetRouterParam,
  getHeader: mockGetHeader,
  readRawBody: mockReadRawBody,
  setResponseHeader: mockSetResponseHeader,
  setResponseStatus: mockSetResponseStatus,
  // Returns "https" to simulate a production request; tests assert on the path only.
  getRequestProtocol: () => "https",
});

// ---------------------------------------------------------------------------
// Import handlers after mocks
// ---------------------------------------------------------------------------

const { default: postHandler } =
  await import("../../server/api/media/index.post");
const { default: deleteHandler } =
  await import("../../server/api/media/[id].delete");
const { default: getHandler } = await import("../../server/api/media/[id].get");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type H3Event = object;

function buildEvent(): H3Event {
  return { context: { userId: "user-1" }, node: { req: { socket: true } } };
}

function callHandler(handler: unknown, event: H3Event): Promise<unknown> {
  return (handler as (event: H3Event) => Promise<unknown>)(event);
}

function resetDbMocks() {
  mockDbInsertReturning.mockResolvedValue([
    { id: "media-123", url: "user-1/media-123" },
  ]);
  mockDbSelectLimit.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function stubHeaders(contentType: string): void {
  mockGetHeader.mockImplementation((_event: unknown, header: string) => {
    if (header === "content-type") {
      return contentType;
    }
    if (header === "host") {
      return "localhost:3000";
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// POST /api/media
// ---------------------------------------------------------------------------

describe("POST /api/media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    stubHeaders("image/jpeg");
    const sampleBuffer = Buffer.from("fake-image-data");
    mockReadRawBody.mockResolvedValue(sampleBuffer);
    resetDbMocks();
  });

  it("returns 201 with id and url on success", async () => {
    const result = (await callHandler(postHandler, buildEvent())) as {
      id: string;
      url: string;
    };

    // The DB insert returns media-123 but the URL uses the UUID generated
    // before the insert. Assert structural shape rather than exact values.
    expect(result.id).toBe("media-123");
    expect(result.url).toMatch(/\/api\/media\//);
    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);
  });

  it("calls putMediaBlob with the correct key pattern and content type", async () => {
    await callHandler(postHandler, buildEvent());

    expect(mockPutMediaBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\//),
      expect.any(Buffer),
      "image/jpeg",
    );
  });

  it("throws 415 for a disallowed content type", async () => {
    stubHeaders("application/pdf");

    await expect(callHandler(postHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  it("throws 400 for an empty body", async () => {
    mockReadRawBody.mockResolvedValue(null);

    await expect(callHandler(postHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 413 when the actual byte length exceeds the limit (post-buffer check)", async () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    mockReadRawBody.mockResolvedValue(oversizedBuffer);

    await expect(callHandler(postHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("throws 413 on Content-Length alone before reading the body (early check)", async () => {
    // Stub content-length to exceed the limit; body is small so only the early
    // check fires, not the post-buffer backstop.
    mockGetHeader.mockImplementation((_event: unknown, header: string) => {
      if (header === "content-type") {
        return "image/jpeg";
      }
      if (header === "content-length") {
        return String(11 * 1024 * 1024);
      }
      if (header === "host") {
        return "localhost:3000";
      }
      return null;
    });

    await expect(callHandler(postHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 413,
    });
    // Body should not have been read; the early check fires before readRawBody.
    expect(mockReadRawBody).not.toHaveBeenCalled();
  });

  it("throws 401 when the user is not authenticated", async () => {
    const authError = Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
    });
    mockEnsureUser.mockRejectedValue(authError);

    await expect(callHandler(postHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("accepts content-type with parameters (e.g. image/jpeg; charset=binary)", async () => {
    stubHeaders("image/jpeg; charset=binary");

    const result = (await callHandler(postHandler, buildEvent())) as {
      id: string;
      url: string;
    };
    expect(result.id).toBe("media-123");
    // Blob should be stored with the stripped content type.
    expect(mockPutMediaBlob).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      "image/jpeg",
    );
  });

  it("removes the blob when the DB insert fails to prevent orphaned storage", async () => {
    const insertError = new Error("DB error");
    mockDbInsertReturning.mockRejectedValue(insertError);

    await expect(callHandler(postHandler, buildEvent())).rejects.toThrow(
      "DB error",
    );
    expect(mockPutMediaBlob).toHaveBeenCalled();
    expect(mockRemoveMediaBlob).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/media/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/media/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetRouterParam.mockReturnValue("media-123");
    mockDbSelectLimit.mockResolvedValue([{ url: "user-1/media-123" }]);
  });

  it("deletes the blob and the database row on success", async () => {
    const result = await callHandler(deleteHandler, buildEvent());

    expect(mockRemoveMediaBlob).toHaveBeenCalledWith("user-1/media-123");
    expect(mockDbDeleteWhere).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("throws 404 when the media row does not exist", async () => {
    mockDbSelectLimit.mockResolvedValue([]);

    await expect(
      callHandler(deleteHandler, buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRemoveMediaBlob).not.toHaveBeenCalled();
  });

  it("throws 404 when the row belongs to another user (ownership scoping)", async () => {
    // The query includes a userId constraint so no row is returned.
    mockDbSelectLimit.mockResolvedValue([]);

    await expect(
      callHandler(deleteHandler, buildEvent()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when the user is not authenticated", async () => {
    const authError = Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
    });
    mockRequireUser.mockImplementation(() => {
      throw authError;
    });

    await expect(
      callHandler(deleteHandler, buildEvent()),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when the route param is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(
      callHandler(deleteHandler, buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns ok and logs when blob removal fails (no cascade error to caller)", async () => {
    mockRemoveMediaBlob.mockRejectedValue(new Error("Blob store unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await callHandler(deleteHandler, buildEvent());

    expect(result).toEqual({ ok: true });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// GET /api/media/[id]
// ---------------------------------------------------------------------------

describe("GET /api/media/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterParam.mockReturnValue("media-123");
    mockDbSelectLimit.mockResolvedValue([
      { url: "user-1/media-123", contentType: "image/jpeg" },
    ]);
    mockGetMediaBlob.mockResolvedValue({
      data: new ArrayBuffer(8),
      contentType: "image/jpeg",
    });
  });

  it("returns blob data and sets Content-Type header", async () => {
    const result = await callHandler(getHandler, buildEvent());

    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      "Content-Type",
      "image/jpeg",
    );
  });

  it("sets Cache-Control to immutable", async () => {
    await callHandler(getHandler, buildEvent());

    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  });

  it("sets X-Content-Type-Options: nosniff to prevent MIME sniffing", async () => {
    await callHandler(getHandler, buildEvent());

    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      "X-Content-Type-Options",
      "nosniff",
    );
  });

  it("throws 404 when the database row does not exist", async () => {
    mockDbSelectLimit.mockResolvedValue([]);

    await expect(callHandler(getHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 404 when the blob is missing from the store", async () => {
    mockGetMediaBlob.mockResolvedValue(null);

    await expect(callHandler(getHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 400 when the route param is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    await expect(callHandler(getHandler, buildEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
