import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../server/utils/entry-helpers", () => ({
  loadEntryRelations: vi.fn().mockResolvedValue({ photos: [], tags: [] }),
}));

import { ensureUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockEnsureUser = vi.mocked(ensureUser);
const mockGetDb = vi.mocked(getDb);

function makeDbForCreate(createdEntry: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([createdEntry]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });

  const tagsReturningMock = vi.fn().mockResolvedValue([{ id: "tag-1" }]);
  const tagsOnConflictMock = vi
    .fn()
    .mockReturnValue({ returning: tagsReturningMock });
  const tagsValuesMock = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: tagsOnConflictMock });

  const photoInsertValuesMock = vi.fn().mockResolvedValue([]);

  return {
    insert: vi.fn().mockImplementation((table: unknown) => {
      const tableName = (
        (table as Record<string, unknown>)["_"] as Record<string, unknown>
      )?.["name"];
      if (tableName === "tags") {
        return { values: tagsValuesMock };
      }
      if (tableName === "entry_tags" || tableName === "entry_photos") {
        return { values: photoInsertValuesMock };
      }
      return { values: valuesMock };
    }),
  };
}

const handler = await import("../../../server/api/entries/index.post");

describe("POST /api/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["title is missing", { body: "Some content" }],
    ["title is empty", { title: "   " }],
    ["occurredAt is not a valid date", { title: "Entry", occurredAt: "bad" }],
    ["tags is not an array", { title: "Entry", tags: "hiking" }],
    ["photoMediaIds is not an array", { title: "Entry", photoMediaIds: "m-1" }],
  ])("throws 400 when %s", async (_label, body) => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue(body);

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when not authenticated", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);
    mockReadBody.mockResolvedValue({ title: "My Entry" });

    const defaultHandler = "default" in handler ? handler.default : handler;

    await expect(
      (defaultHandler as (event: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("creates an entry with only required fields", async () => {
    const createdEntry = {
      id: "e-1",
      userId: "user-1",
      title: "My Entry",
      body: null,
      tripId: null,
      placeId: null,
      weather: null,
      occurredAt: null,
      visibility: "private",
      likeCount: 0,
    };
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ title: "My Entry" });
    const mockDb = makeDbForCreate(createdEntry);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const defaultHandler = "default" in handler ? handler.default : handler;
    const result = await (defaultHandler as (event: unknown) => unknown)({});

    expect(result).toMatchObject(createdEntry);
  });
});
