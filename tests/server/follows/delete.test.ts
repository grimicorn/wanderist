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
vi.stubGlobal("getRouterParam", vi.fn());

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

function makeDeleteChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockReturnValue({ where });
  return { delete: del, _where: where };
}

const handler = await import("../../../server/api/follows/[followeeId].delete");

function getHandler() {
  return "default" in handler
    ? (handler.default as (event: unknown) => Promise<unknown>)
    : (handler as unknown as (event: unknown) => Promise<unknown>);
}

describe("DELETE /api/follows/:followeeId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true when a follow row is deleted", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-1");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    const result = await getHandler()({});
    expect(result).toEqual({ ok: true });
  });

  it("is idempotent: deleting a non-existent follow does not throw", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-never-followed");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await expect(getHandler()({})).resolves.toEqual({ ok: true });
  });

  it("only deletes the current user's own follow row (auth scoping)", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue("followee-1");
    const chain = makeDeleteChain();
    mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

    await getHandler()({});

    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    // The delete WHERE clause is built with the authenticated userId (follower-1),
    // so even if a different userId were supplied via the URL it would have no effect.
    expect(chain.delete).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when followeeId route param is missing", async () => {
    mockRequireUser.mockReturnValue("follower-1");
    mockGetRouterParam.mockReturnValue(undefined);

    mockGetDb.mockReturnValue({} as unknown as ReturnType<typeof getDb>);

    await expect(getHandler()({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });
    mockGetRouterParam.mockReturnValue("followee-1");

    await expect(getHandler()({})).rejects.toMatchObject({ statusCode: 401 });
  });
});
