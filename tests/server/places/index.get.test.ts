import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();
vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...original,
    eq: vi.fn(original.eq),
    and: vi.fn(original.and),
  };
});

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);
const mockGetQuery = vi.mocked(
  globalThis.getQuery as (event: unknown) => Record<string, unknown>,
);

function makeDbWithRows(rows: Record<string, unknown>[]) {
  const whereMock = vi.fn().mockResolvedValue(rows);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock, _where: whereMock };
}

const handler = await import("../../../server/api/places/index.get");

describe("GET /api/places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuery.mockReturnValue({});
  });

  it("returns places scoped to the authenticated user", async () => {
    const expectedPlaces = [
      { id: "p-1", userId: "user-1", name: "Tokyo" },
      { id: "p-2", userId: "user-1", name: "London" },
    ];
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows(expectedPlaces);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(expectedPlaces);
  });

  it("throws 401 when not authenticated", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockRequireUser.mockImplementation(() => {
      throw unauthorizedError;
    });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("passes category filter as a query param when provided", async () => {
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({ category: "museum" });
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    await (defaultHandler as (event: unknown) => unknown)({});

    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("ignores an empty category filter", async () => {
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({ category: "  " });
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    await (defaultHandler as (event: unknown) => unknown)({});

    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});
