import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installNitroGlobals,
  unwrapHandler,
  makeDeleteChain,
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
const mockGetRouterParam = vi.mocked(
  getRouterParam as (event: unknown, name: string) => string | undefined,
);

const handler = await import("../../../server/api/follows/[followeeId].delete");
const callHandler = () => unwrapHandler(handler as Record<string, unknown>)({});

describe("DELETE /api/follows/:followeeId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true when a follow row is deleted", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-1");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await callHandler();
    expect(result).toEqual({ ok: true });
  });

  it("is idempotent: deleting a non-existent follow does not throw", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-never-followed");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).resolves.toEqual({ ok: true });
  });

  it("only deletes the current user's own follow row (auth scoping)", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-1");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await callHandler();

    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(chain.delete).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when followeeId route param is missing", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue(undefined);

    mockGetDb.mockReturnValue({} as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });
    mockGetRouterParam.mockReturnValue("followee-1");

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });
});
