import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockGetRouterParam = vi.fn();
vi.stubGlobal("getRouterParam", mockGetRouterParam);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/db-helpers", () => ({
  loadOwnedOrThrow: vi.fn(),
}));

import { loadOwnedOrThrow } from "../../../server/utils/db-helpers";

const mockLoadOwnedOrThrow = vi.mocked(loadOwnedOrThrow);

const handler = await import("../../../server/api/places/[id].get");

describe("GET /api/places/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the place when found and owned", async () => {
    const expectedPlace = {
      id: "place-1",
      userId: "user-1",
      name: "Tokyo",
    };
    mockGetRouterParam.mockReturnValue("place-1");
    mockLoadOwnedOrThrow.mockResolvedValue(
      expectedPlace as unknown as Awaited<ReturnType<typeof loadOwnedOrThrow>>,
    );

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual(expectedPlace);
    expect(mockLoadOwnedOrThrow).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when id param is missing", async () => {
    mockGetRouterParam.mockReturnValue(undefined);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when place is not found or not owned", async () => {
    mockGetRouterParam.mockReturnValue("place-missing");
    const notFoundError = createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
    mockLoadOwnedOrThrow.mockRejectedValue(notFoundError);

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
    mockLoadOwnedOrThrow.mockRejectedValue(unauthorizedError);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
