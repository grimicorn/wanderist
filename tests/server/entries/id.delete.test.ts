import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";
import {
  makeDbForDelete,
  assertThrows404ViaOwnership,
  assertThrows401ViaOwnership,
} from "./_helpers";

stubNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/db-helpers", () => ({
  requireRouterParam: vi.fn(),
  assertOwnership: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm")>();
  return { ...original, eq: vi.fn(original.eq) };
});

import {
  requireRouterParam,
  assertOwnership,
} from "../../../server/utils/db-helpers";
import { getDb } from "../../../server/db/index";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockAssertOwnership = vi.mocked(assertOwnership);
const mockGetDb = vi.mocked(getDb);

const handler = await import("../../../server/api/entries/[id].delete");

describe("DELETE /api/entries/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the entry and returns success", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual({ success: true });
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
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
    await assertThrows404ViaOwnership(
      mockRequireRouterParam,
      mockAssertOwnership,
      handler,
    );
  });

  it("throws 401 when not authenticated", async () => {
    await assertThrows401ViaOwnership(
      mockRequireRouterParam,
      mockAssertOwnership,
      handler,
    );
  });

  it("calls assertOwnership before deleting", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForDelete();
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    await (defaultHandler as (event: unknown) => unknown)({});

    expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });
});
