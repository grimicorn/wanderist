import { eq } from "drizzle-orm";
import { ensureUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { entries, entryPhotos, entryTags } from "../../db/schema";
import { requireString, optionalString } from "../../utils/db-helpers";
import {
  generateId,
  parseOccurredAt,
  parseVisibility,
  parseRequiredStringArray,
  upsertTags,
  loadEntryRelations,
} from "../../utils/entry-helpers";

type DbClient = ReturnType<typeof getDb>;

async function insertEntryPhotos(
  database: DbClient,
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
  database: DbClient,
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
  if (title === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "title must not be empty",
    });
  }

  const bodyText = optionalString(body?.body, "body");
  const tripId = optionalString(body?.tripId, "tripId");
  const placeId = optionalString(body?.placeId, "placeId");
  const weather = optionalString(body?.weather, "weather");
  const occurredAt = parseOccurredAt(body?.occurredAt);
  const visibility = parseVisibility(body?.visibility);
  const tagNames = parseRequiredStringArray(body?.tags, "tags");
  const photoMediaIds = parseRequiredStringArray(
    body?.photoMediaIds,
    "photoMediaIds",
  );

  const entryId = generateId();

  // Not wrapped in database.transaction(): the app's drizzle client is
  // configured with the neon-http driver everywhere (see server/db/index.ts),
  // which has no transaction support (it issues each query as its own HTTP
  // call). Steps run sequentially instead; upsertTags is already idempotent
  // (insert ... onConflictDoUpdate) so a partial failure there is safe to
  // retry. If a later step still fails, the entry row is deleted below so a
  // 500 never leaves an orphaned entry with missing tags/photos behind.
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

  try {
    const tagIds = await upsertTags(database, tagNames);
    await insertEntryPhotos(database, entryId, photoMediaIds);
    await insertEntryTags(database, entryId, tagIds);

    const relations = await loadEntryRelations(database, entryId);

    return { ...inserted[0], ...relations };
  } catch (error) {
    await database.delete(entries).where(eq(entries.id, entryId));
    throw error;
  }
});
