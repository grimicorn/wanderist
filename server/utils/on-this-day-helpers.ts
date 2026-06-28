import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb } from "../db/index";
import { entries } from "../db/schema";
import { loadEntryRelations } from "./entry-helpers";
import type { EntryRelations } from "./entry-helpers";

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
 * Fetches journal entries that occurred on the same month/day as
 * `referenceDate` but in prior years, scoped to `userId`.
 *
 * Returns entries enriched with photos and tags, ordered by `occurred_at` desc
 * so the most-recent matching year appears first.
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

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const relations = await loadEntryRelations(database, row.id);
      return { ...row, ...relations };
    }),
  );

  return enriched;
}
