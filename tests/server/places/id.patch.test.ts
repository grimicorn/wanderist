import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockGetRouterParam = vi.fn();
vi.stubGlobal("getRouterParam", mockGetRouterParam);

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/db-helpers", () => ({
  assertOwnership: vi.fn(),
  optionalString: vi.fn((value: unknown, _field: string) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      const error = new Error(`must be a string`) as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = 400;
      error.statusMessage = "must be a string";
      throw error;
    }
    return value;
  }),
  optionalNumber: vi.fn((value: unknown, _field: string) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "number" || !isFinite(value)) {
      const error = new Error(`must be a number`) as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = 400;
      error.statusMessage = "must be a number";
      throw error;
    }
    return value;
  }),
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

function makeDbWithUpdate(returned: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([returned]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  return { update: updateMock };
}

const handler = await import("../../../server/api/places/[id].patch");

describe("PATCH /api/places/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates and returns the place", async () => {
    const updatedPlace = { id: "place-1", userId: "user-1", name: "Berlin" };
    mockGetRouterParam.mockReturnValue("place-1");
    mockReadBody.mockResolvedValue({ name: "Berlin" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate(updatedPlace);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(updatedPlace);
  });

  it("throws 400 when id param is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);
    mockReadBody.mockResolvedValue({ name: "Berlin" });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when no fields are provided", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    mockReadBody.mockResolvedValue({});
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when name is an empty string", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    mockReadBody.mockResolvedValue({ name: "   " });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when place is not owned", async () => {
    mockGetRouterParam.mockReturnValue("place-1");
    mockReadBody.mockResolvedValue({ name: "Berlin" });
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
    mockReadBody.mockResolvedValue({ name: "Berlin" });
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
});
