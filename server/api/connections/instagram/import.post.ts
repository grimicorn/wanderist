/**
 * POST /api/connections/instagram/import
 *
 * Pulls the user's recent geotagged Instagram media, fetches image bytes from
 * the Instagram CDN, stores them via the media-storage-and-uploads layer, and
 * creates journal entries linked to the matching place for each photo.
 *
 * Idempotent: items whose Instagram media ID already exists in `media.source_id`
 * for this user are skipped rather than duplicated.
 *
 * Place deduplication: photos taken at the same location (name + coordinates)
 * reuse the existing `places` row rather than inserting duplicates.
 *
 * Returns a summary: { imported: number, skipped: number, errors: string[] }
 */

import { eq, and, inArray } from "drizzle-orm";
import { ensureUser } from "../../../utils/auth";
import { getDb } from "../../../db/index";
import {
  connectedAccounts,
  media,
  entries,
  places,
  entryPhotos,
  CONNECTED_ACCOUNT_PROVIDER,
  MEDIA_SOURCE,
  VISIBILITY,
} from "../../../db/schema";
import { putMediaBlob } from "../../../utils/mediaStore";
import {
  fetchInstagramMedia,
  fetchInstagramImage,
  filterGeotaggedMedia,
  type InstagramMediaItem,
} from "../../../utils/instagramClient";
import { decryptToken } from "../../../utils/tokenCrypto";

type DbClient = ReturnType<typeof getDb>;

function buildEntryTitle(item: InstagramMediaItem): string {
  if (item.caption) {
    return item.caption.slice(0, 100);
  }
  return `Photo from ${item.location!.name}`;
}

function detectContentType(mediaUrl: string): string {
  const pathname = new URL(mediaUrl).pathname.toLowerCase();
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/jpeg";
}

async function fetchAlreadyImportedIds(
  userId: string,
  instagramIds: string[],
): Promise<Set<string>> {
  if (instagramIds.length === 0) {
    return new Set();
  }
  const database = getDb();
  const rows = await database
    .select({ sourceId: media.sourceId })
    .from(media)
    .where(
      and(
        eq(media.userId, userId),
        eq(media.source, MEDIA_SOURCE.INSTAGRAM),
        inArray(media.sourceId, instagramIds),
      ),
    );
  return new Set(rows.map((row) => row.sourceId).filter(Boolean) as string[]);
}

async function resolveOrCreatePlace(
  db: DbClient,
  userId: string,
  item: InstagramMediaItem,
): Promise<string> {
  const locationName = item.location!.name;
  const latitude = item.location!.latitude;
  const longitude = item.location!.longitude;

  const existingRows = await db
    .select({ id: places.id })
    .from(places)
    .where(
      and(
        eq(places.userId, userId),
        eq(places.name, locationName),
        eq(places.latitude, latitude),
        eq(places.longitude, longitude),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    return existingRows[0].id;
  }

  const [placeRow] = await db
    .insert(places)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: locationName,
      latitude,
      longitude,
    })
    .returning({ id: places.id });

  if (!placeRow) {
    throw new Error(
      `Failed to insert place record for Instagram item ${item.id}`,
    );
  }
  return placeRow.id;
}

async function importSinglePhoto(
  userId: string,
  item: InstagramMediaItem,
): Promise<void> {
  const database = getDb();
  const imageBuffer = await fetchInstagramImage(item.media_url);
  const contentType = detectContentType(item.media_url);
  const mediaId = crypto.randomUUID();
  const storageKey = `${userId}/${mediaId}`;

  // Commit DB rows first; then write the blob. This ordering ensures a failed
  // transaction (e.g. a race on the unique index) never leaves an orphaned blob
  // in object storage. The tradeoff is that a failed blob write leaves a media
  // row with a broken URL, but that state is recoverable (re-import will retry
  // since the source_id unique row exists, skipping the entry and not making
  // things worse).
  await database.transaction(async (transaction) => {
    const db = transaction as unknown as DbClient;

    const placeId = await resolveOrCreatePlace(db, userId, item);

    const entryId = crypto.randomUUID();
    const [entryRow] = await db
      .insert(entries)
      .values({
        id: entryId,
        userId,
        placeId,
        title: buildEntryTitle(item),
        body: item.caption ?? null,
        occurredAt: new Date(item.timestamp),
        visibility: VISIBILITY.PRIVATE,
      })
      .returning({ id: entries.id });

    if (!entryRow) {
      throw new Error(`Failed to insert entry for Instagram item ${item.id}`);
    }

    const [mediaRow] = await db
      .insert(media)
      .values({
        id: mediaId,
        userId,
        url: storageKey,
        contentType,
        source: MEDIA_SOURCE.INSTAGRAM,
        sourceId: item.id,
      })
      .returning({ id: media.id });

    if (!mediaRow) {
      throw new Error(
        `Failed to insert media record for Instagram item ${item.id}`,
      );
    }

    await db.insert(entryPhotos).values({
      id: crypto.randomUUID(),
      entryId: entryRow.id,
      mediaId: mediaRow.id,
      sortOrder: 0,
    });
  });

  await putMediaBlob(storageKey, imageBuffer, contentType);
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();

  const connectionRows = await database
    .select({ accessToken: connectedAccounts.accessToken })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM),
      ),
    )
    .limit(1);

  const connection = connectionRows[0];
  if (!connection || !connection.accessToken) {
    throw createError({
      statusCode: 422,
      statusMessage: "Instagram account not connected",
    });
  }

  const accessToken = decryptToken(connection.accessToken);
  const mediaResponse = await fetchInstagramMedia(accessToken);
  const geotagged = filterGeotaggedMedia(mediaResponse.data);

  const instagramIds = geotagged.map((item) => item.id);
  const alreadyImportedIds = await fetchAlreadyImportedIds(
    userId,
    instagramIds,
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of geotagged) {
    if (alreadyImportedIds.has(item.id)) {
      skipped += 1;
      continue;
    }

    try {
      await importSinglePhoto(userId, item);
      imported += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Item ${item.id}: ${message}`);
    }
  }

  return { imported, skipped, errors };
});
