/**
 * POST /api/connections/instagram/import
 *
 * Pulls the user's recent geotagged Instagram media, fetches the image bytes
 * from Instagram's CDN, stores them via the media-storage-and-uploads layer,
 * and creates journal entries linked to matching places for each photo.
 *
 * Returns a summary: { imported: number, skipped: number, errors: string[] }
 */

import { eq, and } from "drizzle-orm";
import { ensureUser } from "../../../utils/auth";
import { getDb } from "../../../db/index";
import {
  connectedAccounts,
  media,
  entries,
  places,
  entryPhotos,
  CONNECTED_ACCOUNT_PROVIDER,
  VISIBILITY,
} from "../../../db/schema";
import { putMediaBlob } from "../../../utils/mediaStore";
import {
  fetchInstagramMedia,
  filterGeotaggedMedia,
  type InstagramMediaItem,
} from "../../../utils/instagramClient";
import { decryptToken } from "../../../utils/tokenCrypto";

const FALLBACK_HOST = "localhost:3000";
const DEFAULT_MEDIA_CONTENT_TYPE = "image/jpeg";

function buildMediaServeUrl(event: object, mediaId: string): string {
  const host =
    (event as { node?: { req?: { headers?: { host?: string } } } }).node?.req
      ?.headers?.host ?? FALLBACK_HOST;
  return `https://${host}/api/media/${mediaId}`;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Instagram image (${response.status}): ${url}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function detectContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) {
    return "image/png";
  }
  if (lower.includes(".webp")) {
    return "image/webp";
  }
  return DEFAULT_MEDIA_CONTENT_TYPE;
}

async function importSinglePhoto(
  event: object,
  userId: string,
  item: InstagramMediaItem,
): Promise<{ mediaId: string; placeId: string; entryId: string } | null> {
  if (!item.location) {
    return null;
  }

  const database = getDb();
  const imageUrl = item.permalink;

  const imageBuffer = await fetchImageBuffer(imageUrl);
  const contentType = detectContentType(imageUrl);
  const mediaId = crypto.randomUUID();
  const storageKey = `${userId}/${mediaId}`;

  await putMediaBlob(storageKey, imageBuffer, contentType);

  const [mediaRow] = await database
    .insert(media)
    .values({
      id: mediaId,
      userId,
      url: storageKey,
      contentType,
    })
    .returning({ id: media.id });

  if (!mediaRow) {
    throw new Error(
      `Failed to insert media record for Instagram item ${item.id}`,
    );
  }

  const placeId = crypto.randomUUID();
  const [placeRow] = await database
    .insert(places)
    .values({
      id: placeId,
      userId,
      name: item.location.name,
      latitude: item.location.latitude,
      longitude: item.location.longitude,
    })
    .returning({ id: places.id });

  if (!placeRow) {
    throw new Error(
      `Failed to insert place record for Instagram item ${item.id}`,
    );
  }

  const entryId = crypto.randomUUID();
  const entryTitle = item.caption
    ? item.caption.slice(0, 100)
    : `Photo from ${item.location.name}`;

  const [entryRow] = await database
    .insert(entries)
    .values({
      id: entryId,
      userId,
      placeId: placeRow.id,
      title: entryTitle,
      body: item.caption ?? null,
      occurredAt: new Date(item.timestamp),
      visibility: VISIBILITY.PRIVATE,
    })
    .returning({ id: entries.id });

  if (!entryRow) {
    throw new Error(`Failed to insert entry for Instagram item ${item.id}`);
  }

  await database.insert(entryPhotos).values({
    id: crypto.randomUUID(),
    entryId: entryRow.id,
    mediaId: mediaRow.id,
    sortOrder: 0,
  });

  return { mediaId: mediaRow.id, placeId: placeRow.id, entryId: entryRow.id };
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

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of geotagged) {
    try {
      const result = await importSinglePhoto(event, userId, item);
      if (result) {
        imported += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Item ${item.id}: ${message}`);
    }
  }

  return { imported, skipped, errors };
});
