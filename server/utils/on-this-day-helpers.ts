import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb } from "../db/index";
import { entries } from "../db/schema";
import { fetchPhotosForEntries, fetchTagsForEntries } from "./entry-helpers";
import type { EntryRelations, PhotoRow, TagRow } from "./entry-helpers";

export type OnThisDayEntry = typeof entries.$inferSelect & EntryRelations;

/**
 * Builds a SQL condition that matches rows whose `occurred_at` falls on the
 * same month/day as `referenceDate` but in a strictly earlier year.
 *
 * Uses EXTRACT so the comparison is timezone-agnostic at the database level
 * (timestamps are stored as UTC; the month/day extracted is UTC month/day).
 */
export function buildOnThisDayFilter(
  userId: string,
  referenceDate: Date,
): SQL[] {
  const referenceMonth = referenceDate.getUTCMonth() + 1;
  const referenceDay = referenceDate.getUTCDate();
  const referenceYear = referenceDate.getUTCFullYear();

  return [
    eq(entries.userId, userId),
    isNotNull(entries.occurredAt),
    sql`EXTRACT(MONTH FROM ${entries.occurredAt}) = ${referenceMonth}`,
    sql`EXTRACT(DAY FROM ${entries.occurredAt}) = ${referenceDay}`,
    sql`EXTRACT(YEAR FROM ${entries.occurredAt}) < ${referenceYear}`,
  ];
}

/**
 * Groups photos by the entry they belong to, preserving the sort order
 * `fetchPhotosForEntries` already applied.
 */
function groupPhotosByEntryId(photos: PhotoRow[]): Map<string, PhotoRow[]> {
  const photosByEntryId = new Map<string, PhotoRow[]>();
  for (const photo of photos) {
    const existing = photosByEntryId.get(photo.entryId);
    if (existing) {
      existing.push(photo);
      continue;
    }
    photosByEntryId.set(photo.entryId, [photo]);
  }
  return photosByEntryId;
}

/**
 * Groups tag rows by the entry they belong to, converting each row into the
 * `{ id, name }` shape `EntryRelations.tags` expects.
 */
function groupTagsByEntryId(
  tagRows: TagRow[],
): Map<string, { id: string; name: string }[]> {
  const tagsByEntryId = new Map<string, { id: string; name: string }[]>();
  for (const tagRow of tagRows) {
    const tag = { id: tagRow.tagId, name: tagRow.tagName };
    const existing = tagsByEntryId.get(tagRow.entryId);
    if (existing) {
      existing.push(tag);
      continue;
    }
    tagsByEntryId.set(tagRow.entryId, [tag]);
  }
  return tagsByEntryId;
}

/**
 * Fetches journal entries that occurred on the same month/day as
 * `referenceDate` but in prior years, scoped to `userId`.
 *
 * Returns entries enriched with photos and tags, ordered by `occurred_at` desc
 * so the most-recent matching year appears first. Relations are fetched in
 * two batched queries (one for photos, one for tags) regardless of how many
 * entries match, instead of two queries per matching entry.
 */
export async function fetchOnThisDayEntries(
  userId: string,
  referenceDate: Date,
): Promise<OnThisDayEntry[]> {
  const database = getDb();
  const filters = buildOnThisDayFilter(userId, referenceDate);

  const rows = await database
    .select()
    .from(entries)
    .where(and(...filters))
    .orderBy(sql`${entries.occurredAt} DESC`);

  if (rows.length === 0) {
    return [];
  }

  const entryIds = rows.map((row) => row.id);
  const [photos, tagRows] = await Promise.all([
    fetchPhotosForEntries(database, entryIds),
    fetchTagsForEntries(database, entryIds),
  ]);

  const photosByEntryId = groupPhotosByEntryId(photos);
  const tagsByEntryId = groupTagsByEntryId(tagRows);

  return rows.map((row) => ({
    ...row,
    photos: photosByEntryId.get(row.id) ?? [],
    tags: tagsByEntryId.get(row.id) ?? [],
  }));
}
