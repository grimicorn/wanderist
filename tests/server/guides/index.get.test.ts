import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

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
    desc: vi.fn(original.desc),
  };
});

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

function makeDbWithRows(rows: Record<string, unknown>[]) {
  const orderByMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock, _where: whereMock };
}

const handler = await import("../../../server/api/guides/index.get");

describe("GET /api/guides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns guides scoped to the authenticated user", async () => {
    const expectedGuides = [
      { id: "g-1", userId: "user-1", title: "Tokyo on foot" },
      { id: "g-2", userId: "user-1", title: "Slow coastlines" },
    ];
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows(expectedGuides);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(expectedGuides);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when the user has no guides", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const mockDb = makeDbWithRows([]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual([]);
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
});
