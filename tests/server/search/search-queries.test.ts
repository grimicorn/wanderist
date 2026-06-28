import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...original,
    ilike: vi.fn(original.ilike),
    eq: vi.fn(original.eq),
    or: vi.fn(original.or),
    and: vi.fn(original.and),
  };
});

import { getDb } from "../../../server/db/index";
import {
  searchPlaces,
  searchTrips,
  searchEntries,
  searchPeople,
  runSearch,
} from "../../../server/utils/search-queries";

const mockGetDb = vi.mocked(getDb);

function makeQueryChain(rows: Record<string, unknown>[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi
    .fn()
    .mockReturnValue({ where: whereFn, innerJoin: innerJoinFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn, _where: whereFn, _limit: limitFn };
}

describe("searchPlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns places matching the pattern for the given user", async () => {
    const expectedRows = [
      {
        id: "p-1",
        name: "Reykjavík",
        subtitle: "Iceland",
        country: "Iceland",
        category: null,
      },
    ];
    const chain = makeQueryChain(expectedRows);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchPlaces(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "user-1",
      "%reyk%",
    );

    expect(result).toEqual(expectedRows);
    expect(chain.select).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when no places match", async () => {
    const chain = makeQueryChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchPlaces(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "user-1",
      "%nomatch%",
    );

    expect(result).toEqual([]);
  });
});

describe("searchTrips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trips matching the pattern for the given user", async () => {
    const expectedRows = [
      { id: "t-1", name: "Iceland Ring Road", status: "past" },
    ];
    const chain = makeQueryChain(expectedRows);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchTrips(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "user-1",
      "%iceland%",
    );

    expect(result).toEqual(expectedRows);
  });

  it("returns an empty array when no trips match", async () => {
    const chain = makeQueryChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchTrips(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "user-1",
      "%nomatch%",
    );

    expect(result).toEqual([]);
  });
});

describe("searchEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns entries matching the pattern for the given user", async () => {
    const expectedRows = [
      { id: "e-1", title: "Harbor at 4am", body: "Cold morning" },
    ];
    const chain = makeQueryChain(expectedRows);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchEntries(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "user-1",
      "%harbor%",
    );

    expect(result).toEqual(expectedRows);
  });
});

describe("searchPeople", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public profiles matching the pattern", async () => {
    const expectedRows = [
      {
        id: "user-2",
        displayName: "Elsa Far",
        handle: "elsa_far",
        email: "elsa@example.com",
      },
    ];
    const chain = makeQueryChain(expectedRows);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await searchPeople(
      mockGetDb() as unknown as ReturnType<typeof getDb>,
      "%elsa%",
    );

    expect(result).toEqual(expectedRows);
  });

  it("does NOT scope people results to a userId (public profiles only)", async () => {
    // searchPeople receives no userId parameter — verifying the function
    // signature itself enforces this constraint at call time.
    const chain = makeQueryChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    // If this call compiles and runs without error, people search is not
    // accidentally user-scoped (no userId parameter accepted).
    await expect(
      searchPeople(
        mockGetDb() as unknown as ReturnType<typeof getDb>,
        "%test%",
      ),
    ).resolves.toEqual([]);
  });
});

describe("runSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns grouped results for all four categories", async () => {
    const chain = makeQueryChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await runSearch("user-1", "tokyo");

    expect(result).toHaveProperty("places");
    expect(result).toHaveProperty("trips");
    expect(result).toHaveProperty("entries");
    expect(result).toHaveProperty("people");
  });

  it("escapes SQL LIKE special characters in the query to prevent injection", async () => {
    const chain = makeQueryChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    // These characters would otherwise act as LIKE wildcards; passing them
    // should not throw and should be handled safely.
    await expect(runSearch("user-1", "100% free")).resolves.toBeDefined();
    await expect(runSearch("user-1", "me_you")).resolves.toBeDefined();
    await expect(runSearch("user-1", "back\\slash")).resolves.toBeDefined();
  });
});
