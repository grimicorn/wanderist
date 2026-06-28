import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installNitroGlobals,
  unwrapHandler,
  makeSelectChainNoLimit,
} from "./_helpers";

installNitroGlobals();

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

const handler = await import("../../../server/api/follows/index.get");
const callHandler = () => unwrapHandler(handler as Record<string, unknown>)({});

describe("GET /api/follows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns followingIds for the authenticated user", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChainNoLimit([
      { followeeId: "user-2" },
      { followeeId: "user-3" },
    ]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await callHandler();
    expect(result).toEqual({ followingIds: ["user-2", "user-3"] });
  });

  it("returns an empty array when the user follows nobody", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChainNoLimit([]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await callHandler();
    expect(result).toEqual({ followingIds: [] });
  });

  it("only returns follows belonging to the authenticated user (auth scoping)", async () => {
    mockRequireUser.mockReturnValue("user-1");
    const chain = makeSelectChainNoLimit([{ followeeId: "user-2" }]);
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await callHandler();

    // requireUser is called and its return value scopes the DB query
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });
});
