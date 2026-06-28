import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";
import {
  assertThrows404ViaOwnership,
  assertThrows401ViaOwnership,
} from "./_helpers";

stubNitroGlobals();

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

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

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../server/utils/entry-helpers", () => ({
  generateId: vi.fn().mockReturnValue("generated-id"),
  parseOccurredAt: vi.fn((value: unknown) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    const date = new Date(value as string);
    if (isNaN(date.getTime())) {
      const error = new Error("bad date") as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = 400;
      error.statusMessage = "occurredAt must be a valid date string";
      throw error;
    }
    return date;
  }),
  parseStringArray: vi.fn((value: unknown, fieldName: string) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      const error = new Error("not array") as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = 400;
      error.statusMessage = `${fieldName} must be an array when provided`;
      throw error;
    }
    return value as string[];
  }),
  upsertTags: vi.fn().mockResolvedValue([]),
  loadEntryRelations: vi.fn().mockResolvedValue({ photos: [], tags: [] }),
  VALID_VISIBILITY: ["private", "public"],
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

function makeDbForPatch(updatedEntry: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([updatedEntry]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });

  const selectWhereMock = vi.fn().mockResolvedValue([updatedEntry]);
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });

  const txClient = {
    update: vi.fn().mockReturnValue({ set: setMock }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({ from: selectFromMock }),
  };

  return {
    transaction: vi
      .fn()
      .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(txClient),
      ),
    _txClient: txClient,
  };
}

const handler = await import("../../../server/api/entries/[id].patch");

describe("PATCH /api/entries/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 400 when id param is missing", async () => {
    const missingError = createError({
      statusCode: 400,
      statusMessage: "id is required",
    });
    mockRequireRouterParam.mockImplementation(() => {
      throw missingError;
    });
    mockReadBody.mockResolvedValue({ title: "Updated" });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when no fields are provided", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockReadBody.mockResolvedValue({});
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForPatch({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when title is empty string", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockReadBody.mockResolvedValue({ title: "   " });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForPatch({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when visibility is invalid", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockReadBody.mockResolvedValue({ visibility: "secret" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForPatch({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when tags is not an array", async () => {
    mockRequireRouterParam.mockReturnValue("e-1");
    mockReadBody.mockResolvedValue({ tags: "hiking" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForPatch({});
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when entry is not owned", async () => {
    mockReadBody.mockResolvedValue({ title: "Updated" });
    await assertThrows404ViaOwnership(
      mockRequireRouterParam,
      mockAssertOwnership,
      handler,
    );
  });

  it("throws 401 when not authenticated", async () => {
    mockReadBody.mockResolvedValue({ title: "Updated" });
    await assertThrows401ViaOwnership(
      mockRequireRouterParam,
      mockAssertOwnership,
      handler,
    );
  });

  it("updates the entry title successfully", async () => {
    const updatedEntry = {
      id: "e-1",
      userId: "user-1",
      title: "Updated Title",
    };
    mockRequireRouterParam.mockReturnValue("e-1");
    mockReadBody.mockResolvedValue({ title: "Updated Title" });
    mockAssertOwnership.mockResolvedValue(undefined);
    const mockDb = makeDbForPatch(updatedEntry);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toMatchObject(updatedEntry);
    expect(mockDb._txClient.update).toHaveBeenCalledTimes(1);
  });
});
