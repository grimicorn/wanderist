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
    desc: vi.fn(original.desc),
    inArray: vi.fn(original.inArray),
  };
});

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);
const mockGetQuery = vi.mocked(
  globalThis.getQuery as (event: unknown) => Record<string, unknown>,
);

function makeDbForListing(rows: Record<string, unknown>[]) {
  const offsetMock = vi.fn().mockResolvedValue(rows);
  const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });

  const photosWhereMock = vi.fn().mockResolvedValue([]);
  const photosFromMock = vi.fn().mockReturnValue({ where: photosWhereMock });

  const tagsWhereMock = vi.fn().mockResolvedValue([]);
  const tagsInnerJoinMock = vi.fn().mockReturnValue({ where: tagsWhereMock });
  const tagsFromMock = vi
    .fn()
    .mockReturnValue({ innerJoin: tagsInnerJoinMock });

  const selectDistinctWhereMock = vi.fn().mockResolvedValue([]);
  const selectDistinctInnerJoinMock = vi
    .fn()
    .mockReturnValue({ where: selectDistinctWhereMock });
  const selectDistinctFromMock = vi
    .fn()
    .mockReturnValue({ innerJoin: selectDistinctInnerJoinMock });
  const selectDistinctMock = vi
    .fn()
    .mockReturnValue({ from: selectDistinctFromMock });

  let callCount = 0;

  return {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { from: fromMock };
      }
      if (callCount === 2) {
        return { from: photosFromMock };
      }
      return { from: tagsFromMock };
    }),
    selectDistinct: selectDistinctMock,
    _whereMock: whereMock,
  };
}

const handler = await import("../../../server/api/entries/index.get");

describe("GET /api/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuery.mockReturnValue({});
  });

  it("returns entries scoped to the authenticated user", async () => {
    const expectedEntries = [
      { id: "e-1", userId: "user-1", title: "First Entry" },
    ];
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbForListing(expectedEntries);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toMatchObject({
      entries: expectedEntries.map((entry) => ({
        ...entry,
        photos: [],
        tags: [],
      })),
      tab: "timeline",
      page: 1,
    });
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

  it.each([
    ["no tab specified", {}, "timeline"],
    ["tab=timeline", { tab: "timeline" }, "timeline"],
    ["invalid tab", { tab: "unknown" }, "timeline"],
  ])("returns tab=timeline when %s", async (_label, query, expectedTab) => {
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue(query);
    const mockDb = makeDbForListing([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = (await (defaultHandler as (event: unknown) => unknown)(
      {},
    )) as { tab: string };

    expect(result.tab).toBe(expectedTab);
  });

  it("defaults to page 1 when no page specified", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbForListing([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = (await (defaultHandler as (event: unknown) => unknown)(
      {},
    )) as {
      page: number;
    };

    expect(result.page).toBe(1);
  });

  it("returns empty entries for photos tab when no entries have photos", async () => {
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({ tab: "photos" });

    const selectDistinctWhereMock = vi.fn().mockResolvedValue([]);
    const selectDistinctInnerJoinMock = vi
      .fn()
      .mockReturnValue({ where: selectDistinctWhereMock });
    const selectDistinctFromMock = vi
      .fn()
      .mockReturnValue({ innerJoin: selectDistinctInnerJoinMock });
    const mockDb = {
      select: vi.fn().mockReturnValue({ from: vi.fn() }),
      selectDistinct: vi.fn().mockReturnValue({ from: selectDistinctFromMock }),
    };
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = (await (defaultHandler as (event: unknown) => unknown)(
      {},
    )) as {
      entries: unknown[];
      tab: string;
    };

    expect(result.entries).toEqual([]);
    expect(result.tab).toBe("photos");
  });
});
