import { eq } from "drizzle-orm";
import {
  assertOwnership,
  optionalString,
  requireRouterParam,
} from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import {
  entries,
  entryPhotos,
  entryTags,
  tags,
  VISIBILITY,
} from "../../db/schema";
import { loadEntryRelations } from "../../utils/entry-helpers";

type EntryUpdates = Partial<typeof entries.$inferInsert>;
type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

const VALID_VISIBILITY = Object.values(VISIBILITY) as Visibility[];

function generateId(): string {
  return crypto.randomUUID();
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

function parseStringArray(
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

function applyTitle(
  updates: EntryUpdates,
  body: Record<string, unknown>,
): void {
  const title = optionalString(body.title, "title");
  if (title === undefined) {
    return;
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "title must not be empty when provided",
    });
  }
  updates.title = trimmedTitle;
}

function applyVisibility(
  updates: EntryUpdates,
  body: Record<string, unknown>,
): void {
  const visibility = body.visibility;
  if (visibility === undefined || visibility === null) {
    return;
  }
  if (!VALID_VISIBILITY.includes(visibility as Visibility)) {
    throw createError({
      statusCode: 400,
      statusMessage: `visibility must be one of: ${VALID_VISIBILITY.join(", ")}`,
    });
  }
  updates.visibility = visibility as Visibility;
}

function applyOccurredAt(
  updates: EntryUpdates,
  body: Record<string, unknown>,
): void {
  if (body.occurredAt === undefined || body.occurredAt === null) {
    return;
  }
  updates.occurredAt = parseOccurredAt(body.occurredAt);
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

async function replaceEntryTags(
  database: ReturnType<typeof getDb>,
  entryId: string,
  tagNames: string[],
): Promise<void> {
  await database.delete(entryTags).where(eq(entryTags.entryId, entryId));

  const tagIds = await upsertTags(database, tagNames);
  if (tagIds.length === 0) {
    return;
  }

  await database
    .insert(entryTags)
    .values(tagIds.map((tagId) => ({ entryId, tagId })));
}

async function replaceEntryPhotos(
  database: ReturnType<typeof getDb>,
  entryId: string,
  mediaIds: string[],
): Promise<void> {
  await database.delete(entryPhotos).where(eq(entryPhotos.entryId, entryId));

  if (mediaIds.length === 0) {
    return;
  }

  await database.insert(entryPhotos).values(
    mediaIds.map((mediaId, index) => ({
      id: generateId(),
      entryId,
      mediaId,
      sortOrder: index,
    })),
  );
}

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(event, entries, entries.id, entries.userId, id);

  const database = getDb();
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const updates: EntryUpdates = {};

  applyTitle(updates, body);
  applyVisibility(updates, body);
  applyOccurredAt(updates, body);

  const bodyText = optionalString(body?.body, "body");
  if (bodyText !== undefined) {
    updates.body = bodyText;
  }

  const tripId = optionalString(body?.tripId, "tripId");
  if (tripId !== undefined) {
    updates.tripId = tripId;
  }

  const placeId = optionalString(body?.placeId, "placeId");
  if (placeId !== undefined) {
    updates.placeId = placeId;
  }

  const weather = optionalString(body?.weather, "weather");
  if (weather !== undefined) {
    updates.weather = weather;
  }

  const tagNames = parseStringArray(body?.tags, "tags");
  const photoMediaIds = parseStringArray(body?.photoMediaIds, "photoMediaIds");

  const hasScalarUpdates = Object.keys(updates).length > 0;
  const hasTagUpdates = tagNames !== undefined;
  const hasPhotoUpdates = photoMediaIds !== undefined;

  if (!hasScalarUpdates && !hasTagUpdates && !hasPhotoUpdates) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided for update",
    });
  }

  let updated = null;

  if (hasScalarUpdates) {
    const rows = await database
      .update(entries)
      .set(updates)
      .where(eq(entries.id, id))
      .returning();
    updated = rows[0];
  }

  await Promise.all([
    hasTagUpdates
      ? replaceEntryTags(database, id, tagNames)
      : Promise.resolve(),
    hasPhotoUpdates
      ? replaceEntryPhotos(database, id, photoMediaIds)
      : Promise.resolve(),
  ]);

  if (!updated) {
    const rows = await database
      .select()
      .from(entries)
      .where(eq(entries.id, id));
    updated = rows[0];
  }

  const relations = await loadEntryRelations(database, id);

  return { ...updated, ...relations };
});
