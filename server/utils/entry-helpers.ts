import { eq, inArray } from "drizzle-orm";
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
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      continue;
    }
    const existing = await database
      .insert(tags)
      .values({ id: generateId(), name: trimmedName })
      .onConflictDoUpdate({ target: tags.name, set: { name: trimmedName } })
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
    .where(inArray(entryPhotos.entryId, entryIds));
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

export type EntryRow = typeof entries.$inferSelect;
