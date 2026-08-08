import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../../test-utils";
import {
  makeDbForUpdate,
  assertThrows404WhenNotOwned,
  assertThrows401WhenUnauthenticated,
} from "../../entries/_helpers";

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
  return { ...original, eq: vi.fn(original.eq), sql: original.sql };
});

import { eq } from "drizzle-orm";
import {
  requireRouterParam,
  loadOwnedOrThrow,
} from "../../../../server/utils/db-helpers";
import { getDb } from "../../../../server/db/index";
import { guides } from "../../../../server/db/schema";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockLoadOwnedOrThrow = vi.mocked(loadOwnedOrThrow);
const mockGetDb = vi.mocked(getDb);

const handler = await import("../../../../server/api/guides/[id]/like.delete");

describe("DELETE /api/guides/:id/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrements likeCount and returns the updated guide", async () => {
    const guideBefore = {
      id: "g-1",
      userId: "user-1",
      title: "Guide",
      likeCount: 2,
    };
    const guideAfter = { ...guideBefore, likeCount: 1 };
    mockRequireRouterParam.mockReturnValue("g-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      guideBefore as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );
    const mockDb = makeDbForUpdate(guideAfter);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toMatchObject(guideAfter);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    // Guard against a dropped/broad WHERE that would touch every guide's count.
    expect(vi.mocked(eq)).toHaveBeenCalledWith(guides.id, "g-1");
  });

  it("does not go below 0 when likeCount is already 0", async () => {
    const guideAtZero = {
      id: "g-1",
      userId: "user-1",
      title: "Guide",
      likeCount: 0,
    };
    mockRequireRouterParam.mockReturnValue("g-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      guideAtZero as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );

    const mockDb = makeDbForUpdate(guideAtZero);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toMatchObject(guideAtZero);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("throws 404 when the guide is deleted between the load and the update", async () => {
    const guideBefore = {
      id: "g-1",
      userId: "user-1",
      title: "Guide",
      likeCount: 2,
    };
    mockRequireRouterParam.mockReturnValue("g-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      guideBefore as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );
    // returning() yields [] — the row is gone by the time the update runs.
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const mockDb = { update: vi.fn().mockReturnValue({ set: setMock }) };
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 404 });
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

  it("throws 404 when guide is not owned", async () => {
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
