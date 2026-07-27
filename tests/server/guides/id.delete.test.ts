import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

vi.mock("../../../server/utils/db-helpers", () => ({
  requireRouterParam: vi.fn(),
  assertOwnership: vi.fn(),
}));

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return { ...original, eq: vi.fn(original.eq), and: vi.fn(original.and) };
});

import { eq, and } from "drizzle-orm";
import {
  requireRouterParam,
  assertOwnership,
} from "../../../server/utils/db-helpers";
import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";
import { guides } from "../../../server/db/schema";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockAssertOwnership = vi.mocked(assertOwnership);
const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);
const mockEq = vi.mocked(eq);
const mockAnd = vi.mocked(and);

function makeDbForDelete() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
  return { delete: deleteMock, _where: whereMock };
}

const handler = await import("../../../server/api/guides/[id].delete");

describe("DELETE /api/guides/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
  });

  it("deletes the guide and returns success", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await (
      handler.default as (event: unknown) => Promise<unknown>
    )({});

    expect(result).toEqual({ success: true });
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    // The delete's own where clause must also scope to the owner — the
    // preceding assertOwnership check is not the only guard against a
    // cross-tenant delete.
    expect(mockEq).toHaveBeenCalledWith(guides.id, "guide-1");
    expect(mockEq).toHaveBeenCalledWith(guides.userId, "user-1");
    expect(mockAnd).toHaveBeenCalled();
  });

  it("throws 400 when id param is missing", async () => {
    const missingError = createError({
      statusCode: 400,
      statusMessage: "id is required",
    });
    mockRequireRouterParam.mockImplementation(() => {
      throw missingError;
    });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("a user cannot delete another user's guide — 404 from assertOwnership propagates", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    const notFoundError = createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
    mockAssertOwnership.mockRejectedValue(notFoundError);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when not authenticated", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockAssertOwnership.mockRejectedValue(unauthorizedError);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("calls assertOwnership before deleting", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await (handler.default as (event: unknown) => Promise<unknown>)({});

    expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });
});
