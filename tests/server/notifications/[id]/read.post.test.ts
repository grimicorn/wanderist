import { describe, it, expect, vi, beforeEach } from "vitest";
import { installNitroGlobals, makeUpdateChain } from "../_helpers";

installNitroGlobals();

vi.mock("../../../../server/utils/db-helpers", () => ({
  requireRouterParam: vi.fn(),
  assertOwnership: vi.fn(),
}));

vi.mock("../../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import {
  requireRouterParam,
  assertOwnership,
} from "../../../../server/utils/db-helpers";
import { getDb } from "../../../../server/db/index";

const mockRequireRouterParam = vi.mocked(requireRouterParam);
const mockAssertOwnership = vi.mocked(assertOwnership);
const mockGetDb = vi.mocked(getDb);

const handler =
  await import("../../../../server/api/notifications/[id]/read.post");
const defaultHandler = "default" in handler ? handler.default : handler;
const callHandler = () => (defaultHandler as (event: unknown) => unknown)({});

describe("POST /api/notifications/:id/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the owned notification as read and returns ok:true", async () => {
    mockRequireRouterParam.mockReturnValue("notif-1");
    mockAssertOwnership.mockResolvedValue(undefined);

    const updateChain = makeUpdateChain();
    mockGetDb.mockReturnValue(
      updateChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();

    expect(result).toEqual({ ok: true });
    expect(updateChain.update).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when id param is missing", async () => {
    const missingError = createError({
      statusCode: 400,
      statusMessage: "id is required",
    });
    mockRequireRouterParam.mockImplementation(() => {
      throw missingError;
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireRouterParam.mockReturnValue("notif-1");
    mockAssertOwnership.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 404 when the notification is not owned by the user", async () => {
    mockRequireRouterParam.mockReturnValue("notif-1");
    mockAssertOwnership.mockImplementation(() => {
      throw createError({ statusCode: 404, statusMessage: "Not found" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 404 });
  });
});
