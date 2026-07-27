import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

vi.mock("../../../server/utils/db-helpers", () => ({
  requireRouterParam: vi.fn(),
  assertOwnership: vi.fn(),
  optionalString: vi.fn((value: unknown, _field: string) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      const error = new Error("must be a string") as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = 400;
      error.statusMessage = "must be a string";
      throw error;
    }
    return value;
  }),
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

import {
  requireRouterParam,
  assertOwnership,
} from "../../../server/utils/db-helpers";
import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockAssertOwnership = vi.mocked(assertOwnership);
const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

function makeDbWithUpdate(returned: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([returned]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  return { update: updateMock, _set: setMock };
}

const handler = await import("../../../server/api/guides/[id].patch");

describe("PATCH /api/guides/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
  });

  it("updates and returns the guide", async () => {
    const updatedGuide = {
      id: "guide-1",
      userId: "user-1",
      title: "Tokyo on foot, updated",
    };
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ title: "Tokyo on foot, updated" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate(updatedGuide);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await (
      handler.default as (event: unknown) => Promise<unknown>
    )({});

    expect(result).toEqual(updatedGuide);
    expect(mockAssertOwnership).toHaveBeenCalledTimes(1);
  });

  it("a user cannot patch another user's guide — 404 from assertOwnership propagates", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ title: "Hijacked title" });
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
    mockReadBody.mockResolvedValue({ title: "Hijacked title" });
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockAssertOwnership.mockRejectedValue(unauthorizedError);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when id param is missing", async () => {
    const missingError = createError({
      statusCode: 400,
      statusMessage: "id is required",
    });
    mockRequireRouterParam.mockImplementation(() => {
      throw missingError;
    });
    mockReadBody.mockResolvedValue({ title: "Tokyo on foot" });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when no fields are provided", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({});
    mockAssertOwnership.mockResolvedValue(undefined);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when title is an empty string", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ title: "   " });
    mockAssertOwnership.mockResolvedValue(undefined);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid visibility value", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ visibility: "friends-only" });
    mockAssertOwnership.mockResolvedValue(undefined);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when readTimeMinutes is less than 1", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ readTimeMinutes: 0 });
    mockAssertOwnership.mockResolvedValue(undefined);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("updates visibility from private to public", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ visibility: "public" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate({
      id: "guide-1",
      visibility: "public",
    });
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await (handler.default as (event: unknown) => Promise<unknown>)({});

    expect(mockDb._set).toHaveBeenCalledWith({ visibility: "public" });
  });

  it("never accepts likeCount as a patchable field", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ title: "New title", likeCount: 9999 });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbWithUpdate({ id: "guide-1", title: "New title" });
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await (handler.default as (event: unknown) => Promise<unknown>)({});

    expect(mockDb._set).toHaveBeenCalledWith(
      expect.not.objectContaining({ likeCount: expect.anything() }),
    );
  });

  it("throws 404 when the row is gone by the time of the write (race with a concurrent delete)", async () => {
    mockRequireRouterParam.mockReturnValue("guide-1");
    mockReadBody.mockResolvedValue({ title: "New title" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
