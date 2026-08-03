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

import { eq, desc } from "drizzle-orm";
import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";
import { guides } from "../../../server/db/schema";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);
const mockEq = vi.mocked(eq);
const mockDesc = vi.mocked(desc);

function makeDbWithRows(
  rows: Record<string, unknown>[],
  likeRows: { contentId: string }[] = [],
) {
  const orderByMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });

  // Second select() is likedContentIds: select({ contentId }).from().where().
  const likesWhereMock = vi.fn().mockResolvedValue(likeRows);
  const likesFromMock = vi.fn().mockReturnValue({ where: likesWhereMock });

  let call = 0;
  const selectMock = vi.fn().mockImplementation(() => {
    call += 1;
    if (call === 1) {
      return { from: fromMock };
    }
    return { from: likesFromMock };
  });
  return { select: selectMock, _where: whereMock };
}

const handler = await import("../../../server/api/guides/index.get");

describe("GET /api/guides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns guides scoped to the authenticated user, flagged by like state", async () => {
    const storedGuides = [
      { id: "g-1", userId: "user-1", title: "Tokyo on foot" },
      { id: "g-2", userId: "user-1", title: "Slow coastlines" },
    ];
    mockRequireUser.mockReturnValue("user-1");
    // The user has liked g-1 but not g-2.
    const mockDb = makeDbWithRows(storedGuides, [{ contentId: "g-1" }]);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual([
      { ...storedGuides[0], likedByCurrentUser: true },
      { ...storedGuides[1], likedByCurrentUser: false },
    ]);
    // The list must be scoped to the authenticated user, not every guide.
    expect(mockEq).toHaveBeenCalledWith(guides.userId, "user-1");
    expect(mockDesc).toHaveBeenCalledWith(guides.createdAt);
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
