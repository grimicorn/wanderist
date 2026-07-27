import { describe, it, expect, vi } from "vitest";
import { stubNitroGlobals } from "../test-utils";
import { loadRelationsForEntries } from "../../../server/utils/entry-helpers";
import type { getDb } from "../../../server/db/index";

stubNitroGlobals();

/**
 * Builds a fake database whose `select()` returns the photo query chain on
 * its first call and the tag query chain on its second call, matching the
 * order `loadRelationsForEntries` invokes `fetchPhotosForEntries` and
 * `fetchTagsForEntries` in.
 */
function createFakeDatabase(photoRows: unknown[], tagRows: unknown[]) {
  const photoChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(photoRows),
      }),
    }),
  };
  const tagChain = {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(tagRows),
      }),
    }),
  };
  const select = vi
    .fn()
    .mockReturnValueOnce(photoChain)
    .mockReturnValueOnce(tagChain);

  return { select } as unknown as ReturnType<typeof getDb>;
}

describe("loadRelationsForEntries", () => {
  it("returns an empty map and issues no queries when entryIds is empty", async () => {
    const database = createFakeDatabase([], []);

    const result = await loadRelationsForEntries(database, []);

    expect(result.size).toBe(0);
    expect(database.select).not.toHaveBeenCalled();
  });

  it("seeds every requested entryId with empty photos/tags before merging results", async () => {
    const database = createFakeDatabase([], []);

    const result = await loadRelationsForEntries(database, ["e-1", "e-2"]);

    expect(result.get("e-1")).toEqual({ photos: [], tags: [] });
    expect(result.get("e-2")).toEqual({ photos: [], tags: [] });
  });

  it("associates photos and tags to the correct entry, not just the first one", async () => {
    const photoRows = [
      { id: "p-1", entryId: "e-2", mediaId: "m-1", sortOrder: 0 },
      { id: "p-2", entryId: "e-1", mediaId: "m-2", sortOrder: 0 },
      { id: "p-3", entryId: "e-1", mediaId: "m-3", sortOrder: 1 },
    ];
    const tagRows = [
      { entryId: "e-2", tagId: "t-1", tagName: "beach" },
      { entryId: "e-1", tagId: "t-2", tagName: "mountains" },
    ];
    const database = createFakeDatabase(photoRows, tagRows);

    const result = await loadRelationsForEntries(database, ["e-1", "e-2"]);

    expect(result.get("e-1")?.photos.map((photo) => photo.id)).toEqual([
      "p-2",
      "p-3",
    ]);
    expect(result.get("e-1")?.tags).toEqual([{ id: "t-2", name: "mountains" }]);

    expect(result.get("e-2")?.photos.map((photo) => photo.id)).toEqual(["p-1"]);
    expect(result.get("e-2")?.tags).toEqual([{ id: "t-1", name: "beach" }]);
  });

  it("ignores relation rows for entries outside the requested set", async () => {
    const photoRows = [
      { id: "p-1", entryId: "e-999", mediaId: "m-1", sortOrder: 0 },
    ];
    const tagRows = [{ entryId: "e-999", tagId: "t-1", tagName: "beach" }];
    const database = createFakeDatabase(photoRows, tagRows);

    const result = await loadRelationsForEntries(database, ["e-1"]);

    expect(result.get("e-1")).toEqual({ photos: [], tags: [] });
    expect(result.has("e-999")).toBe(false);
  });
});
