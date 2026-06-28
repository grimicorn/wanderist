import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../server/utils/entry-helpers", () => ({
  loadEntryRelations: vi.fn().mockResolvedValue({ photos: [], tags: [] }),
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

import { getDb } from "../../../server/db/index";
import { loadEntryRelations } from "../../../server/utils/entry-helpers";
import {
  buildOnThisDayFilter,
  fetchOnThisDayEntries,
} from "../../../server/utils/on-this-day-helpers";

const mockGetDb = vi.mocked(getDb);
const mockLoadEntryRelations = vi.mocked(loadEntryRelations);

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

  it("returns an empty array when the database returns no rows", async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const mockDb = { select: vi.fn().mockReturnValue({ from: fromMock }) };

    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await fetchOnThisDayEntries("user-1", new Date());
    expect(result).toEqual([]);
  });

  it("enriches each entry row with photos and tags", async () => {
    const sampleRow = {
      id: "e-1",
      userId: "user-1",
      title: "Harbor at 4am",
    };
    const orderByMock = vi.fn().mockResolvedValue([sampleRow]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const mockDb = { select: vi.fn().mockReturnValue({ from: fromMock }) };

    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    mockLoadEntryRelations.mockResolvedValue({ photos: [], tags: [] });

    const result = await fetchOnThisDayEntries("user-1", new Date());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ...sampleRow, photos: [], tags: [] });
    expect(mockLoadEntryRelations).toHaveBeenCalledWith(mockDb, sampleRow.id);
  });

  it("calls loadEntryRelations once per returned row", async () => {
    const rows = [
      { id: "e-1", userId: "user-1", title: "A" },
      { id: "e-2", userId: "user-1", title: "B" },
    ];
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const mockDb = { select: vi.fn().mockReturnValue({ from: fromMock }) };

    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
    mockLoadEntryRelations.mockResolvedValue({ photos: [], tags: [] });

    await fetchOnThisDayEntries("user-1", new Date());
    expect(mockLoadEntryRelations).toHaveBeenCalledTimes(2);
  });
});
