import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

// Only requireRouterParam/assertOwnership are stubbed (they hit the DB and
// the authenticated user respectively) — optionalString is the real
// implementation from db-helpers.ts, so a real regression there fails these
// tests instead of a hand-written clone silently drifting out of sync.
vi.mock("../../../server/utils/db-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../server/utils/db-helpers")>();
  return {
    ...actual,
    requireRouterParam: vi.fn(),
    assertOwnership: vi.fn(),
  };
});

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
    // The update's own where clause must also scope to the owner — the
    // preceding assertOwnership check is not the only guard against a
    // cross-tenant patch.
    expect(mockEq).toHaveBeenCalledWith(guides.id, "guide-1");
    expect(mockEq).toHaveBeenCalledWith(guides.userId, "user-1");
    expect(mockAnd).toHaveBeenCalled();
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
