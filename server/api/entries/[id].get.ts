import { eq, inArray } from "drizzle-orm";
import { loadOwnedOrThrow, requireRouterParam } from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { entries, entryPhotos, entryTags, tags } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  const entry = await loadOwnedOrThrow(
    event,
    entries,
    entries.id,
    entries.userId,
    id,
  );

  const database = getDb();

  const [photos, tagRows] = await Promise.all([
    database.select().from(entryPhotos).where(eq(entryPhotos.entryId, id)),
    database
      .select({
        entryId: entryTags.entryId,
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(entryTags)
      .innerJoin(tags, eq(entryTags.tagId, tags.id))
      .where(eq(entryTags.entryId, id)),
  ]);

  return {
    ...entry,
    photos,
    tags: tagRows.map((tagRow) => ({ id: tagRow.tagId, name: tagRow.tagName })),
  };
});
