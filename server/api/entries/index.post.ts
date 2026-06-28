import { ensureUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import {
  entries,
  entryPhotos,
  entryTags,
  tags,
  VISIBILITY,
} from "../../db/schema";
import { requireString, optionalString } from "../../utils/db-helpers";

type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

const VALID_VISIBILITY = Object.values(VISIBILITY) as Visibility[];

function generateId(): string {
  return crypto.randomUUID();
}

function parseVisibility(value: unknown): Visibility {
  if (VALID_VISIBILITY.includes(value as Visibility)) {
    return value as Visibility;
  }
  return VISIBILITY.PRIVATE;
}

function parseOccurredAt(value: unknown): Date | undefined {
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

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be an array when provided`,
    });
  }
  for (const item of value) {
    if (typeof item !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: `${fieldName} must be an array of strings`,
      });
    }
  }
  return value as string[];
}

async function upsertTags(
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

async function insertEntryPhotos(
  database: ReturnType<typeof getDb>,
  entryId: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) {
    return;
  }
  const photoRows = mediaIds.map((mediaId, index) => ({
    id: generateId(),
    entryId,
    mediaId,
    sortOrder: index,
  }));
  await database.insert(entryPhotos).values(photoRows);
}

async function insertEntryTags(
  database: ReturnType<typeof getDb>,
  entryId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }
  const tagRows = tagIds.map((tagId) => ({ entryId, tagId }));
  await database.insert(entryTags).values(tagRows);
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;

  requireString(body?.title, "title");
  const title = (body.title as string).trim();

  const bodyText = optionalString(body?.body, "body");
  const tripId = optionalString(body?.tripId, "tripId");
  const placeId = optionalString(body?.placeId, "placeId");
  const weather = optionalString(body?.weather, "weather");
  const occurredAt = parseOccurredAt(body?.occurredAt);
  const visibility = parseVisibility(body?.visibility);
  const tagNames = parseStringArray(body?.tags, "tags");
  const photoMediaIds = parseStringArray(body?.photoMediaIds, "photoMediaIds");

  const entryId = generateId();

  const inserted = await database
    .insert(entries)
    .values({
      id: entryId,
      userId,
      title,
      body: bodyText,
      tripId,
      placeId,
      weather,
      occurredAt,
      visibility,
    })
    .returning();

  const tagIds = await upsertTags(database, tagNames);

  await Promise.all([
    insertEntryPhotos(database, entryId, photoMediaIds),
    insertEntryTags(database, entryId, tagIds),
  ]);

  return inserted[0];
});
