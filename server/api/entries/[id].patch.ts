import { eq } from "drizzle-orm";
import {
  assertOwnership,
  optionalString,
  requireRouterParam,
} from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { entries, entryPhotos, entryTags } from "../../db/schema";
import {
  generateId,
  parseOccurredAt,
  parseStringArray,
  upsertTags,
  loadEntryRelations,
  VALID_VISIBILITY,
  type EntryVisibility,
} from "../../utils/entry-helpers";

type EntryUpdates = Partial<typeof entries.$inferInsert>;
type DbClient = ReturnType<typeof getDb>;

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
  if (!VALID_VISIBILITY.includes(visibility as EntryVisibility)) {
    throw createError({
      statusCode: 400,
      statusMessage: `visibility must be one of: ${VALID_VISIBILITY.join(", ")}`,
    });
  }
  updates.visibility = visibility as EntryVisibility;
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

async function replaceEntryTags(
  tx: DbClient,
  entryId: string,
  tagNames: string[],
): Promise<void> {
  await tx.delete(entryTags).where(eq(entryTags.entryId, entryId));

  const tagIds = await upsertTags(tx, tagNames);
  if (tagIds.length === 0) {
    return;
  }

  await tx
    .insert(entryTags)
    .values(tagIds.map((tagId) => ({ entryId, tagId })));
}

async function replaceEntryPhotos(
  tx: DbClient,
  entryId: string,
  mediaIds: string[],
): Promise<void> {
  await tx.delete(entryPhotos).where(eq(entryPhotos.entryId, entryId));

  if (mediaIds.length === 0) {
    return;
  }

  await tx.insert(entryPhotos).values(
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

  return database.transaction(async (transaction) => {
    const txClient = transaction as unknown as DbClient;

    let updated: typeof entries.$inferSelect | null = null;

    if (hasScalarUpdates) {
      const rows = await txClient
        .update(entries)
        .set(updates)
        .where(eq(entries.id, id))
        .returning();
      updated = rows[0];
    }

    if (tagNames !== undefined) {
      await replaceEntryTags(txClient, id, tagNames);
    }
    if (photoMediaIds !== undefined) {
      await replaceEntryPhotos(txClient, id, photoMediaIds);
    }

    if (!updated) {
      const rows = await txClient
        .select()
        .from(entries)
        .where(eq(entries.id, id));
      updated = rows[0];
    }

    const relations = await loadEntryRelations(txClient, id);

    return { ...updated, ...relations };
  });
});
