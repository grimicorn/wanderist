import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../../test-utils";
import {
  makeDbForUpdate,
  assertThrows404WhenNotOwned,
  assertThrows401WhenUnauthenticated,
} from "../_helpers";

stubNitroGlobals();

vi.mock("../../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../../server/utils/db-helpers", () => ({
  requireRouterParam: vi.fn(),
  loadOwnedOrThrow: vi.fn(),
}));

vi.mock("../../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...original,
    eq: vi.fn(original.eq),
    sql: original.sql,
    gt: vi.fn(original.gt),
  };
});

import {
  requireRouterParam,
  loadOwnedOrThrow,
} from "../../../../server/utils/db-helpers";
import { getDb } from "../../../../server/db/index";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockLoadOwnedOrThrow = vi.mocked(loadOwnedOrThrow);
const mockGetDb = vi.mocked(getDb);

const handler = await import("../../../../server/api/entries/[id]/like.delete");

describe("DELETE /api/entries/:id/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrements likeCount and returns the updated entry", async () => {
    const entryBefore = {
      id: "e-1",
      userId: "user-1",
      title: "Entry",
      likeCount: 2,
    };
    const entryAfter = { ...entryBefore, likeCount: 1 };
    mockRequireRouterParam.mockReturnValue("e-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      entryBefore as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );
    const mockDb = makeDbForUpdate(entryAfter);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(entryAfter);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("does not go below 0 when likeCount is already 0", async () => {
    const entryAtZero = {
      id: "e-1",
      userId: "user-1",
      title: "Entry",
      likeCount: 0,
    };
    mockRequireRouterParam.mockReturnValue("e-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      entryAtZero as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(entryAtZero);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("throws 400 when id param is missing", async () => {
    const missingError = createError({
      statusCode: 400,
      statusMessage: "id is required",
    });
    mockRequireRouterParam.mockImplementation(() => {
      throw missingError;
    });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when entry is not owned", async () => {
    await assertThrows404WhenNotOwned(
      mockRequireRouterParam,
      mockLoadOwnedOrThrow,
      handler,
    );
  });

  it("throws 401 when not authenticated", async () => {
    await assertThrows401WhenUnauthenticated(
      mockRequireRouterParam,
      mockLoadOwnedOrThrow,
      handler,
    );
  });
});
