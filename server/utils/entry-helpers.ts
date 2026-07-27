import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/index";
import {
  entries,
  entryPhotos,
  entryTags,
  tags,
  VISIBILITY,
} from "../db/schema";

export type EntryVisibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];
export type PhotoRow = typeof entryPhotos.$inferSelect;
type TagRow = { entryId: string; tagId: string; tagName: string };

export const VALID_VISIBILITY = Object.values(VISIBILITY) as EntryVisibility[];

export function generateId(): string {
  return crypto.randomUUID();
}

export function parseVisibility(value: unknown): EntryVisibility {
  if (VALID_VISIBILITY.includes(value as EntryVisibility)) {
    return value as EntryVisibility;
  }
  return VISIBILITY.PRIVATE;
}

export function parseOccurredAt(value: unknown): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw createError({
      statusCode: 400,
      statusMessage: "occurredAt must be a valid date string",
    });
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "occurredAt must be a valid date string",
    });
  }
  return date;
}

export function parseStringArray(
  value: unknown,
  fieldName: string,
): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be an array when provided`,
    });
  }
  const allStrings = value.every((item) => typeof item === "string");
  if (!allStrings) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be an array of strings`,
    });
  }
  return value as string[];
}

export function parseRequiredStringArray(
  value: unknown,
  fieldName: string,
): string[] {
  const result = parseStringArray(value, fieldName);
  return result ?? [];
}

export async function upsertTags(
  database: ReturnType<typeof getDb>,
  tagNames: string[],
): Promise<string[]> {
  const uniqueNames = [
    ...new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
  ];
  const tagIds: string[] = [];
  for (const name of uniqueNames) {
    const existing = await database
      .insert(tags)
      .values({ id: generateId(), name })
      .onConflictDoUpdate({ target: tags.name, set: { name } })
      .returning({ id: tags.id });
    tagIds.push(existing[0].id);
  }
  return tagIds;
}

export interface EntryRelations {
  photos: PhotoRow[];
  tags: { id: string; name: string }[];
}

async function fetchPhotosForEntries(
  database: ReturnType<typeof getDb>,
  entryIds: string[],
): Promise<PhotoRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select()
    .from(entryPhotos)
    .where(inArray(entryPhotos.entryId, entryIds))
    .orderBy(asc(entryPhotos.sortOrder));
}

async function fetchTagsForEntries(
  database: ReturnType<typeof getDb>,
  entryIds: string[],
): Promise<TagRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select({ entryId: entryTags.entryId, tagId: tags.id, tagName: tags.name })
    .from(entryTags)
    .innerJoin(tags, eq(entryTags.tagId, tags.id))
    .where(inArray(entryTags.entryId, entryIds));
}

/**
 * Fetches photos and tags for a single entry by ID. Returns them in the shape
 * expected by the Entry type in the store so every endpoint returns a
 * consistent enriched response. Delegates to `loadRelationsForEntries` so the
 * two never drift on how a tag row is reshaped into `{ id, name }`.
 */
export async function loadEntryRelations(
  database: ReturnType<typeof getDb>,
  entryId: string,
): Promise<EntryRelations> {
  const relationsByEntryId = await loadRelationsForEntries(database, [entryId]);
  const relations = relationsByEntryId.get(entryId);
  if (!relations) {
    throw new Error(
      `loadRelationsForEntries did not return relations for entry ${entryId}`,
    );
  }
  return relations;
}

/**
 * Fetches photos and tags for many entries at once, in 2 batched queries
 * regardless of how many entries are requested (instead of 2 queries per
 * entry). Every requested `entryId` is present in the returned map, even
 * when it has no photos or tags, so callers never need to fall back to a
 * default.
 */
export async function loadRelationsForEntries(
  database: ReturnType<typeof getDb>,
  entryIds: string[],
): Promise<Map<string, EntryRelations>> {
  const relationsByEntryId = new Map<string, EntryRelations>(
    entryIds.map((entryId) => [entryId, { photos: [], tags: [] }]),
  );

  if (entryIds.length === 0) {
    return relationsByEntryId;
  }

  const [photos, tagRows] = await Promise.all([
    fetchPhotosForEntries(database, entryIds),
    fetchTagsForEntries(database, entryIds),
  ]);

  for (const photo of photos) {
    relationsByEntryId.get(photo.entryId)?.photos.push(photo);
  }
  for (const tagRow of tagRows) {
    relationsByEntryId
      .get(tagRow.entryId)
      ?.tags.push({ id: tagRow.tagId, name: tagRow.tagName });
  }

  return relationsByEntryId;
}

export type EntryRow = typeof entries.$inferSelect;
