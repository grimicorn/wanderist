import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/on-this-day-helpers", () => ({
  fetchOnThisDayEntries: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { fetchOnThisDayEntries } from "../../../server/utils/on-this-day-helpers";

const mockRequireUser = vi.mocked(requireUser);
const mockFetchOnThisDayEntries = vi.mocked(fetchOnThisDayEntries);

const handler = await import("../../../server/api/entries/on-this-day.get");

describe("GET /api/entries/on-this-day", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns entries scoped to the authenticated user", async () => {
    const sampleEntries = [
      { id: "e-1", userId: "user-1", title: "Old entry", photos: [], tags: [] },
    ];
    mockRequireUser.mockReturnValue("user-1");
    mockFetchOnThisDayEntries.mockResolvedValue(
      sampleEntries as unknown as Awaited<
        ReturnType<typeof fetchOnThisDayEntries>
      >,
    );

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual({ entries: sampleEntries });
    expect(mockFetchOnThisDayEntries).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
    );
  });

  it("passes today's date to fetchOnThisDayEntries", async () => {
    mockRequireUser.mockReturnValue("user-1");
    mockFetchOnThisDayEntries.mockResolvedValue([]);

    const before = Date.now();
    const defaultHandler = "default" in handler ? handler.default : handler;
    await (defaultHandler as (event: unknown) => unknown)({});
    const after = Date.now();

    const [, referenceDate] = mockFetchOnThisDayEntries.mock.calls[0] as [
      string,
      Date,
    ];
    expect(referenceDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(referenceDate.getTime()).toBeLessThanOrEqual(after);
  });

  it("returns an empty entries array when there are no matches", async () => {
    mockRequireUser.mockReturnValue("user-1");
    mockFetchOnThisDayEntries.mockResolvedValue([]);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toEqual({ entries: [] });
  });

  it("throws 401 when not authenticated", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockRequireUser.mockImplementation(() => {
      throw unauthorizedError;
    });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
