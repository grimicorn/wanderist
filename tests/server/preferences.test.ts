import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Nitro auto-imports before any module under test loads
vi.stubGlobal(
  "defineEventHandler",
  (handler: (event: unknown) => unknown) => handler,
);
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    error.statusCode = options.statusCode;
    error.statusMessage = options.statusMessage;
    return error;
  },
);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal(
  "useRuntimeConfig",
  vi.fn(() => ({ databaseUrl: "postgres://test" })),
);

vi.mock("../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../server/utils/db-helpers", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../server/utils/db-helpers")>();
  return { ...original };
});

import { ensureUser } from "../../server/utils/auth";
import { getDb } from "../../server/db/index";

const mockEnsureUser = vi.mocked(ensureUser);
const mockGetDb = vi.mocked(getDb);
const mockReadBody = vi.mocked(
  globalThis.readBody as (event: unknown) => Promise<unknown>,
);

// ---------------------------------------------------------------------------
// DB mock factory — builds a chainable Drizzle-like query builder.
// ---------------------------------------------------------------------------

function makeSelectChain(rows: Record<string, unknown>[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
}

function makeInsertChain(onConflictDoUpdateResult: unknown = undefined) {
  const onConflictDoUpdateMock = vi
    .fn()
    .mockResolvedValue(onConflictDoUpdateResult);
  const valuesMock = vi.fn().mockReturnValue({
    onConflictDoUpdate: onConflictDoUpdateMock,
  });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
  return {
    insert: insertMock,
    _values: valuesMock,
    _onConflict: onConflictDoUpdateMock,
  };
}

function makeFullDb(
  selectRows: Record<string, unknown>[],
  onConflictResult?: unknown,
) {
  const selectChain = makeSelectChain(selectRows);
  const insertChain = makeInsertChain(onConflictResult);
  return { ...selectChain, ...insertChain };
}

// ---------------------------------------------------------------------------
// GET /api/preferences
// ---------------------------------------------------------------------------

const getHandler = await import("../../server/api/preferences.get");
const getPreferences =
  "default" in getHandler
    ? (getHandler.default as (event: unknown) => unknown)
    : getHandler;

describe("GET /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing preferences row when one exists", async () => {
    const preferenceRow = {
      userId: "user-1",
      distanceUnit: "km",
      defaultMapStyle: "dark",
      publicProfile: true,
      preciseLocation: false,
      showOnExplore: true,
      displayName: "Dan",
      handle: "danh",
      homeBase: "St. Louis",
      bio: "Traveler",
    };
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetDb.mockReturnValue(
      makeFullDb([preferenceRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (getPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(preferenceRow);
  });

  it("returns defaults when no preferences row exists", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (getPreferences as (e: unknown) => unknown)({});

    expect(result).toMatchObject({
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
    });
  });

  it("throws 401 when ensureUser rejects with 401", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);

    await expect(
      (getPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("scopes the query to the authenticated user", async () => {
    mockEnsureUser.mockResolvedValue("user-abc");
    const db = makeFullDb([]) as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(db);

    await (getPreferences as (e: unknown) => unknown)({});

    expect(mockEnsureUser).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/preferences
// ---------------------------------------------------------------------------

const patchHandler = await import("../../server/api/preferences.patch");
const patchPreferences =
  "default" in patchHandler
    ? (patchHandler.default as (event: unknown) => unknown)
    : patchHandler;

const updatedRow = {
  userId: "user-1",
  distanceUnit: "km",
  defaultMapStyle: "dark",
  publicProfile: true,
  preciseLocation: true,
  showOnExplore: false,
  displayName: "Dan Updated",
  handle: "danh",
  homeBase: "Chicago",
  bio: "Updated bio",
};

describe("PATCH /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists valid preferences and returns the updated row", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ distanceUnit: "km", publicProfile: true });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (patchPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(updatedRow);
  });

  it("rejects an invalid distanceUnit with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ distanceUnit: "leagues" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid defaultMapStyle with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ defaultMapStyle: "neon" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-boolean privacy field with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ publicProfile: "yes" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-string displayName with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ displayName: 42 });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an empty body with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-object body with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue("not an object");
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when ensureUser rejects", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);
    mockReadBody.mockResolvedValue({ distanceUnit: "km" });

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("accepts valid boolean privacy fields", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      publicProfile: false,
      preciseLocation: true,
      showOnExplore: false,
    });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (patchPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(updatedRow);
  });

  it("accepts all valid map styles without throwing", async () => {
    const validStyles = [
      "outdoors",
      "streets",
      "satellite",
      "light",
      "dark",
      "custom",
    ];

    for (const style of validStyles) {
      mockEnsureUser.mockResolvedValue("user-1");
      mockReadBody.mockResolvedValue({ defaultMapStyle: style });
      mockGetDb.mockReturnValue(
        makeFullDb([
          { ...updatedRow, defaultMapStyle: style },
        ]) as unknown as ReturnType<typeof getDb>,
      );

      await expect(
        (patchPreferences as (e: unknown) => unknown)({}),
      ).resolves.toBeDefined();
    }
  });
});
