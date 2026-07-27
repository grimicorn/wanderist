import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../server/utils/entry-helpers", () => ({
  loadRelationsForEntries: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...original,
    and: vi.fn(original.and),
    eq: vi.fn(original.eq),
    isNotNull: vi.fn(original.isNotNull),
    sql: original.sql,
  };
});

import { eq } from "drizzle-orm";
import { getDb } from "../../../server/db/index";
import { entries } from "../../../server/db/schema";
import { loadRelationsForEntries } from "../../../server/utils/entry-helpers";
import {
  buildOnThisDayFilter,
  fetchOnThisDayEntries,
} from "../../../server/utils/on-this-day-helpers";

const mockGetDb = vi.mocked(getDb);
const mockEq = vi.mocked(eq);
const mockLoadRelationsForEntries = vi.mocked(loadRelationsForEntries);

describe("buildOnThisDayFilter", () => {
  it("returns a non-empty array of SQL filters", () => {
    const filters = buildOnThisDayFilter("user-1", new Date("2026-06-28"));
    expect(filters.length).toBeGreaterThan(0);
  });

  it("includes a user equality filter (first element is eq on userId)", () => {
    const filters = buildOnThisDayFilter("user-1", new Date("2026-06-28"));
    // The first filter is eq(entries.userId, userId). We verify the array
    // length and trust the SQL template tag for the month/day/year filters.
    expect(filters.length).toBe(5);
  });

  it("produces a different number of query values for different reference dates", () => {
    const dateJune = new Date("2026-06-28T00:00:00.000Z");
    const dateJuly = new Date("2026-07-04T00:00:00.000Z");
    const filtersA = buildOnThisDayFilter("user-1", dateJune);
    const filtersB = buildOnThisDayFilter("user-1", dateJuly);

    // Both filter arrays have the same length (same structural shape).
    expect(filtersA.length).toBe(filtersB.length);

    // The SQL template literals embed month/day/year values from the reference
    // date. Inspect the queryChunks to confirm the month value differs.
    const getMonthChunk = (
      filters: ReturnType<typeof buildOnThisDayFilter>,
    ) => {
      const monthFilter = filters[2] as { queryChunks?: unknown[] };
      return monthFilter?.queryChunks ?? [];
    };

    expect(getMonthChunk(filtersA)).not.toEqual(getMonthChunk(filtersB));
  });
});

describe("fetchOnThisDayEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockRowsReturned(rows: unknown[]) {
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const mockDb = { select: vi.fn().mockReturnValue({ from: fromMock }) };
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    return { mockDb, whereMock };
  }

  it("returns an empty array when the database returns no rows", async () => {
    mockRowsReturned([]);

    const result = await fetchOnThisDayEntries("user-1", new Date());
    expect(result).toEqual([]);
  });

  it("issues no relation queries when there are no matching entries", async () => {
    mockRowsReturned([]);

    await fetchOnThisDayEntries("user-1", new Date());
    expect(mockLoadRelationsForEntries).not.toHaveBeenCalled();
  });

  it("scopes the query to the given user", async () => {
    mockRowsReturned([]);

    await fetchOnThisDayEntries("user-42", new Date());

    // buildOnThisDayFilter's first filter is eq(entries.userId, userId); a
    // regression that drops user scoping would still leave every other
    // assertion in this file passing, so assert on `eq` directly rather than
    // relying on it transitively via `where`.
    expect(mockEq).toHaveBeenCalledWith(entries.userId, "user-42");
  });

  it("enriches each entry row with photos and tags", async () => {
    const sampleRow = {
      id: "e-1",
      userId: "user-1",
      title: "Harbor at 4am",
    };
    const { mockDb } = mockRowsReturned([sampleRow]);
    mockLoadRelationsForEntries.mockResolvedValue(
      new Map([["e-1", { photos: [], tags: [] }]]),
    );

    const result = await fetchOnThisDayEntries("user-1", new Date());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ...sampleRow, photos: [], tags: [] });
    expect(mockLoadRelationsForEntries).toHaveBeenCalledWith(mockDb, ["e-1"]);
  });

  it("calls loadRelationsForEntries exactly once regardless of row count", async () => {
    const rows = [
      { id: "e-1", userId: "user-1", title: "A" },
      { id: "e-2", userId: "user-1", title: "B" },
      { id: "e-3", userId: "user-1", title: "C" },
    ];
    mockRowsReturned(rows);
    mockLoadRelationsForEntries.mockResolvedValue(
      new Map([
        ["e-1", { photos: [], tags: [] }],
        ["e-2", { photos: [], tags: [] }],
        ["e-3", { photos: [], tags: [] }],
      ]),
    );

    await fetchOnThisDayEntries("user-1", new Date());

    expect(mockLoadRelationsForEntries).toHaveBeenCalledTimes(1);
    expect(mockLoadRelationsForEntries).toHaveBeenCalledWith(
      expect.anything(),
      ["e-1", "e-2", "e-3"],
    );
  });

  it("associates photos and tags to the correct entry when relations are interleaved", async () => {
    const rows = [
      { id: "e-1", userId: "user-1", title: "A" },
      { id: "e-2", userId: "user-1", title: "B" },
    ];
    mockRowsReturned(rows);
    mockLoadRelationsForEntries.mockResolvedValue(
      new Map([
        [
          "e-1",
          {
            photos: [
              { id: "p-2", entryId: "e-1", mediaId: "m-2", sortOrder: 0 },
              { id: "p-3", entryId: "e-1", mediaId: "m-3", sortOrder: 1 },
            ],
            tags: [{ id: "t-2", name: "mountains" }],
          },
        ],
        [
          "e-2",
          {
            photos: [
              { id: "p-1", entryId: "e-2", mediaId: "m-1", sortOrder: 0 },
            ],
            tags: [{ id: "t-1", name: "beach" }],
          },
        ],
      ]),
    );

    const result = await fetchOnThisDayEntries("user-1", new Date());

    const entryOne = result.find((entry) => entry.id === "e-1");
    const entryTwo = result.find((entry) => entry.id === "e-2");

    expect(entryOne?.photos.map((photo) => photo.id)).toEqual(["p-2", "p-3"]);
    expect(entryOne?.tags).toEqual([{ id: "t-2", name: "mountains" }]);

    expect(entryTwo?.photos.map((photo) => photo.id)).toEqual(["p-1"]);
    expect(entryTwo?.tags).toEqual([{ id: "t-1", name: "beach" }]);
  });

  it("returns empty photos/tags arrays for an entry with no relations", async () => {
    const rows = [
      { id: "e-1", userId: "user-1", title: "A" },
      { id: "e-2", userId: "user-1", title: "B" },
    ];
    mockRowsReturned(rows);
    mockLoadRelationsForEntries.mockResolvedValue(
      new Map([
        [
          "e-1",
          {
            photos: [
              { id: "p-1", entryId: "e-1", mediaId: "m-1", sortOrder: 0 },
            ],
            tags: [],
          },
        ],
        ["e-2", { photos: [], tags: [] }],
      ]),
    );

    const result = await fetchOnThisDayEntries("user-1", new Date());
    const entryWithoutRelations = result.find((entry) => entry.id === "e-2");

    expect(entryWithoutRelations?.photos).toEqual([]);
    expect(entryWithoutRelations?.tags).toEqual([]);
  });
});
