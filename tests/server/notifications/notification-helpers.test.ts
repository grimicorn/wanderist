import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeInsertChain } from "./_helpers";

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../../../server/db/index";

const mockGetDb = vi.mocked(getDb);

const { createNotification } =
  await import("../../../server/utils/notification-helpers");

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a notification row with the provided input", async () => {
    const insertChain = makeInsertChain();
    mockGetDb.mockReturnValue(
      insertChain as unknown as ReturnType<typeof getDb>,
    );

    await createNotification({
      userId: "user-1",
      type: "new_follower",
      tone: "accent",
      body: "Someone started following you",
    });

    expect(insertChain.insert).toHaveBeenCalled();
    const valuesCall = insertChain.insert.mock.results[0].value.values;
    const insertedValue = valuesCall.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(insertedValue.userId).toBe("user-1");
    expect(insertedValue.type).toBe("new_follower");
    expect(insertedValue.tone).toBe("accent");
    expect(insertedValue.body).toBe("Someone started following you");
    expect(typeof insertedValue.id).toBe("string");
    expect(insertedValue.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("does not throw when the database insert fails (swallows and logs)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetDb.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      }),
    } as unknown as ReturnType<typeof getDb>);

    await expect(
      createNotification({
        userId: "user-1",
        type: "new_follower",
        tone: "accent",
        body: "Someone started following you",
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
