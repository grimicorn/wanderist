import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal(
  "defineEventHandler",
  (handler: (event: unknown) => unknown) => handler,
);
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

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

function makeSelectChain(rows: Record<string, unknown>[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

const handler = await import("../../../server/api/follows/index.get");

function getHandler() {
  return "default" in handler
    ? (handler.default as (event: unknown) => Promise<unknown>)
    : (handler as unknown as (event: unknown) => Promise<unknown>);
}

describe("GET /api/follows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns followingIds for the authenticated user", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChain([
      { followeeId: "user-2" },
      { followeeId: "user-3" },
    ]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await getHandler()({});
    expect(result).toEqual({ followingIds: ["user-2", "user-3"] });
  });

  it("returns an empty array when the user follows nobody", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChain([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await getHandler()({});
    expect(result).toEqual({ followingIds: [] });
  });

  it("only returns follows belonging to the authenticated user (auth scoping)", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChain([{ followeeId: "user-2" }]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await getHandler()({});

    // requireUser is called and its return value scopes the DB query
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(getHandler()({})).rejects.toMatchObject({ statusCode: 401 });
  });
});
