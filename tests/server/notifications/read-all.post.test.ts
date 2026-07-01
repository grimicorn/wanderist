import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installNitroGlobals,
  unwrapHandler,
  makeUpdateChain,
} from "./_helpers";

installNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

const handler = await import("../../../server/api/notifications/read-all.post");
const callHandler = () => unwrapHandler(handler as Record<string, unknown>)({});

describe("POST /api/notifications/read-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true when the user is authenticated", async () => {
    mockRequireUser.mockReturnValue("user-1");

    const updateChain = makeUpdateChain();
    mockGetDb.mockReturnValue(
      updateChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();
    expect(result).toEqual({ ok: true });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });
});
