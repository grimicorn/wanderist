import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock h3 createError so it's available without the Nuxt runtime
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    error.statusCode = options.statusCode;
    error.statusMessage = options.statusMessage;
    return error;
  },
);

// Mock the auth util before importing db-helpers
vi.mock("../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

// Mock the db module before importing db-helpers
vi.mock("../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { requireUser } from "../../server/utils/auth";
import { getDb } from "../../server/db/index";
import {
  loadOwnedOrThrow,
  assertOwnership,
  requireString,
  optionalString,
} from "../../server/utils/db-helpers";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

function makeMockEvent() {
  return {} as Parameters<typeof loadOwnedOrThrow>[0];
}

function makeMockTable() {
  return {} as Parameters<typeof loadOwnedOrThrow>[1];
}

function makeMockColumn() {
  return {} as Parameters<typeof loadOwnedOrThrow>[2];
}

function makeDbWithRows(rows: Record<string, unknown>[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock, _where: whereMock, _limit: limitMock };
}

// ---------------------------------------------------------------------------
// loadOwnedOrThrow
// ---------------------------------------------------------------------------

describe("loadOwnedOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the row when found and owned", async () => {
    const expectedRow = { id: "row-1", userId: "user-1", name: "trip" };
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows([expectedRow]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await loadOwnedOrThrow(
      makeMockEvent(),
      makeMockTable(),
      makeMockColumn(),
      makeMockColumn(),
      "row-1",
    );

    expect(result).toEqual(expectedRow);
  });

  it("throws 401 when requireUser throws", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockRequireUser.mockImplementation(() => {
      throw unauthorizedError;
    });

    await expect(
      loadOwnedOrThrow(
        makeMockEvent(),
        makeMockTable(),
        makeMockColumn(),
        makeMockColumn(),
        "row-1",
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 404 when the row is not found", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      loadOwnedOrThrow(
        makeMockEvent(),
        makeMockTable(),
        makeMockColumn(),
        makeMockColumn(),
        "missing-id",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when no rows match (ownership mismatch)", async () => {
    mockRequireUser.mockReturnValue("user-2");
    // DB returns empty because the WHERE clause includes userId = user-2
    // but the row belongs to user-1; the DB mock simulates that correctly
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      loadOwnedOrThrow(
        makeMockEvent(),
        makeMockTable(),
        makeMockColumn(),
        makeMockColumn(),
        "row-1",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// assertOwnership
// ---------------------------------------------------------------------------

describe("assertOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error when the row is owned", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows([{ id: "row-1", userId: "user-1" }]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      assertOwnership(
        makeMockEvent(),
        makeMockTable(),
        makeMockColumn(),
        makeMockColumn(),
        "row-1",
      ),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when not found", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      assertOwnership(
        makeMockEvent(),
        makeMockTable(),
        makeMockColumn(),
        makeMockColumn(),
        "missing",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// requireString
// ---------------------------------------------------------------------------

describe("requireString", () => {
  it("does not throw for a valid non-empty string", () => {
    expect(() => requireString("hello", "name")).not.toThrow();
  });

  it("throws 400 for an empty string", () => {
    expect(() => requireString("", "name")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for a whitespace-only string", () => {
    expect(() => requireString("   ", "name")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for a number", () => {
    expect(() => requireString(42, "name")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for null", () => {
    expect(() => requireString(null, "name")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for undefined", () => {
    expect(() => requireString(undefined, "name")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("includes the field name in the error message", () => {
    expect(() => requireString("", "title")).toThrow(
      expect.objectContaining({
        statusMessage: expect.stringContaining("title"),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// optionalString
// ---------------------------------------------------------------------------

describe("optionalString", () => {
  it("returns the string when provided", () => {
    expect(optionalString("hello", "bio")).toBe("hello");
  });

  it("returns undefined for undefined", () => {
    expect(optionalString(undefined, "bio")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(optionalString(null, "bio")).toBeUndefined();
  });

  it("throws 400 when the value is a number", () => {
    expect(() => optionalString(42, "bio")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is a boolean", () => {
    expect(() => optionalString(true, "bio")).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("includes the field name in the error message", () => {
    expect(() => optionalString(123, "location")).toThrow(
      expect.objectContaining({
        statusMessage: expect.stringContaining("location"),
      }),
    );
  });
});
