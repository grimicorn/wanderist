import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockGetRouterParam = vi.fn();
vi.stubGlobal("getRouterParam", mockGetRouterParam);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/db-helpers", () => ({
  assertOwnership: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return { ...original, eq: vi.fn(original.eq) };
});

import { assertOwnership } from "../../../server/utils/db-helpers";
import { getDb } from "../../../server/db/index";

const mockAssertOwnership = vi.mocked(assertOwnership);
const mockGetDb = vi.mocked(getDb);

function makeDbForDelete() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
  return { delete: deleteMock };
}

const handler = await import("../../../server/api/places/[id].delete");

describe("DELETE /api/places/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the place and returns success", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual({ success: true });
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when id param is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when place is not owned", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    const notFoundError = createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
    mockAssertOwnership.mockRejectedValue(notFoundError);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when not authenticated", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockAssertOwnership.mockRejectedValue(unauthorizedError);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("calls assertOwnership before deleting", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    await (defaultHandler as (event: unknown) => unknown)({});

    expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });
});
