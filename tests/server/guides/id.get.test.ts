import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

// requireRouterParam is stubbed (it reads the event's route params); the
// visibility rule under test lives in the real loadReadableGuide from
// guide-helpers.ts, so it is intentionally NOT mocked — a regression there
// fails these tests.
vi.mock("../../../server/utils/db-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../server/utils/db-helpers")>();
  return {
    ...actual,
    requireRouterParam: vi.fn(),
  };
});

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { requireRouterParam } from "../../../server/utils/db-helpers";
import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

function makeDbWithGuide(rows: Record<string, unknown>[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
}

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

function makeGuide(overrides: Record<string, unknown>) {
  return {
    id: "guide-1",
    userId: OWNER_ID,
    title: "Tokyo on foot",
    body: "Start in Yanaka at sunrise.",
    readTimeMinutes: 8,
    likeCount: 3,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const handler = await import("../../../server/api/guides/[id].get");

function runHandler() {
  return (handler.default as (event: unknown) => Promise<unknown>)({});
}

describe("GET /api/guides/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRouterParam.mockReturnValue("guide-1");
  });

  it("returns a private guide to its owner, including the body", async () => {
    const guide = makeGuide({ visibility: "private", userId: OWNER_ID });
    mockRequireUser.mockReturnValue(OWNER_ID);
    mockGetDb.mockReturnValue(
      makeDbWithGuide([guide]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await runHandler();

    expect(result).toEqual(guide);
    expect((result as { body: string }).body).toBe(
      "Start in Yanaka at sunrise.",
    );
  });

  it("returns a public guide to a non-owner", async () => {
    const guide = makeGuide({ visibility: "public", userId: OWNER_ID });
    mockRequireUser.mockReturnValue(OTHER_ID);
    mockGetDb.mockReturnValue(
      makeDbWithGuide([guide]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await runHandler();

    expect(result).toEqual(guide);
  });

  it("hides a private guide from a non-owner with a 404", async () => {
    const guide = makeGuide({ visibility: "private", userId: OWNER_ID });
    mockRequireUser.mockReturnValue(OTHER_ID);
    mockGetDb.mockReturnValue(
      makeDbWithGuide([guide]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(runHandler()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when the guide does not exist", async () => {
    mockRequireUser.mockReturnValue(OWNER_ID);
    mockGetDb.mockReturnValue(
      makeDbWithGuide([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(runHandler()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 401 when not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(runHandler()).rejects.toMatchObject({ statusCode: 401 });
  });
});
