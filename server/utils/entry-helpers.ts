import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db/index";
import { entryPhotos, entryTags, tags } from "../db/schema";

type TagRow = { entryId: string; tagId: string; tagName: string };
type PhotoRow = typeof entryPhotos.$inferSelect;

async function fetchPhotosForEntries(
  database: ReturnType<typeof getDb>,
  entryIds: string[],
): Promise<PhotoRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  if (entryIds.length === 1) {
    return database
      .select()
      .from(entryPhotos)
      .where(eq(entryPhotos.entryId, entryIds[0]));
  }
  return database
    .select()
    .from(entryPhotos)
    .where(inArray(entryPhotos.entryId, entryIds));
}

async function fetchTagsForEntries(
  database: ReturnType<typeof getDb>,
  entryIds: string[],
): Promise<TagRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  if (entryIds.length === 1) {
    return database
      .select({
        entryId: entryTags.entryId,
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(entryTags)
      .innerJoin(tags, eq(entryTags.tagId, tags.id))
      .where(eq(entryTags.entryId, entryIds[0]));
  }
  return database
    .select({ entryId: entryTags.entryId, tagId: tags.id, tagName: tags.name })
    .from(entryTags)
    .innerJoin(tags, eq(entryTags.tagId, tags.id))
    .where(inArray(entryTags.entryId, entryIds));
}

export interface EntryRelations {
  photos: PhotoRow[];
  tags: { id: string; name: string }[];
}

/**
 * Fetches photos and tags for a single entry by ID. Returns them in the shape
 * expected by the `Entry` type in the store so every endpoint returns a
 * consistent enriched response.
 */
export async function loadEntryRelations(
  database: ReturnType<typeof getDb>,
  entryId: string,
): Promise<EntryRelations> {
  const [photos, tagRows] = await Promise.all([
    fetchPhotosForEntries(database, [entryId]),
    fetchTagsForEntries(database, [entryId]),
  ]);

  return {
    photos,
    tags: tagRows.map((row) => ({ id: row.tagId, name: row.tagName })),
  };
}
