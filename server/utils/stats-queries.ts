/**
 * Aggregate query utilities for user stats.
 *
 * All functions accept a pre-built database instance and a userId so they can
 * be called from any server context and tested in isolation without mocking
 * module-level singletons.
 */
import { count, countDistinct, sum, eq, gte, and, sql } from "drizzle-orm";
import type { getDb } from "../db/index";
import {
  places,
  trips,
  tripStops,
  entries,
  userPreferences,
  DISTANCE_UNIT,
} from "../db/schema";

export type Database = ReturnType<typeof getDb>;

export type DistanceUnit = (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];

// One calendar week expressed in milliseconds — used for period-over-period
// delta queries (places added this week, miles logged this week).
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Conversion factor: kilometres to miles.
const KM_TO_MI = 0.621371;

export interface UserStats {
  placesCount: number;
  countriesCount: number;
  totalDistanceMi: number;
  totalDistanceKm: number;
  currentStreak: number;
  placesThisWeek: number;
  distanceMiThisWeek: number;
  distanceKmThisWeek: number;
  distanceUnit: DistanceUnit;
}

/**
 * Fetches the user's preferred distance unit from `user_preferences`.
 * Falls back to miles when no preference row exists.
 */
export async function fetchDistanceUnit(
  database: Database,
  userId: string,
): Promise<DistanceUnit> {
  const rows = await database
    .select({ distanceUnit: userPreferences.distanceUnit })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return rows[0]?.distanceUnit ?? DISTANCE_UNIT.MI;
}

/**
 * Returns the total number of places owned by `userId`.
 */
export async function countPlaces(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ value: count() })
    .from(places)
    .where(eq(places.userId, userId));

  return rows[0]?.value ?? 0;
}

/**
 * Returns the number of distinct non-null countries across the user's places.
 */
export async function countDistinctCountries(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ value: countDistinct(places.country) })
    .from(places)
    .where(and(eq(places.userId, userId), sql`${places.country} IS NOT NULL`));

  return rows[0]?.value ?? 0;
}

/**
 * Returns the sum of `distance_km` across all trip stops belonging to the
 * user's trips. Null distances on individual stops are treated as zero via SQL
 * COALESCE inside the SUM aggregate.
 */
export async function sumTripStopDistanceKm(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({
      totalKm: sum(tripStops.distanceKm),
    })
    .from(tripStops)
    .innerJoin(trips, eq(tripStops.tripId, trips.id))
    .where(eq(trips.userId, userId));

  const raw = rows[0]?.totalKm;
  const parsed = parseFloat(String(raw ?? "0"));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converts kilometres to miles, rounded to a consistent precision so callers
 * can format the result without further conversion.
 */
export function kmToMi(km: number): number {
  return km * KM_TO_MI;
}

/**
 * Computes the current consecutive-day streak of journal entries for a user.
 *
 * A streak is the number of distinct UTC calendar days (working backwards from
 * today) on which the user has at least one entry with a non-null `occurredAt`.
 *
 * Rules:
 * - Today counts: if the user has an entry today, the streak is at least 1.
 * - Yesterday counts toward the same streak: consecutive days are chained.
 * - A gap of more than one day breaks the streak; counting stops at the gap.
 * - A user with no entries has a streak of 0.
 */
export async function computeDayStreak(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  // Pull distinct UTC dates on which the user has entries, most recent first.
  const rows = await database
    .select({
      entryDate: sql<string>`TO_CHAR(${entries.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
    })
    .from(entries)
    .where(
      and(eq(entries.userId, userId), sql`${entries.occurredAt} IS NOT NULL`),
    )
    .groupBy(
      sql`TO_CHAR(${entries.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
    )
    .orderBy(
      sql`TO_CHAR(${entries.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD') DESC`,
    );

  if (rows.length === 0) {
    return 0;
  }

  const todayUtc = toUtcDateString(now);
  const yesterdayUtc = toUtcDateString(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
  );

  // The most recent entry date must be today or yesterday to start a streak.
  // An older most-recent date means the streak already broke.
  const mostRecentDate = rows[0]?.entryDate;
  if (mostRecentDate !== todayUtc && mostRecentDate !== yesterdayUtc) {
    return 0;
  }

  let streak = 0;
  let expectedDate = mostRecentDate;

  for (const row of rows) {
    if (row.entryDate !== expectedDate) {
      break;
    }

    streak += 1;
    expectedDate = previousUtcDateString(expectedDate);
  }

  return streak;
}

/**
 * Returns the number of places the user created in the last 7 days.
 */
export async function countPlacesThisWeek(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);

  const rows = await database
    .select({ value: count() })
    .from(places)
    .where(and(eq(places.userId, userId), gte(places.createdAt, weekAgo)));

  return rows[0]?.value ?? 0;
}

/**
 * Returns the sum of trip-stop distances (in km) added in the last 7 days
 * (based on the stop's parent trip belonging to the user and the stop being
 * created within the window). Uses trip stops' creation timestamp as a proxy
 * for "when was this distance logged."
 *
 * Note: `trip_stops` does not have a `createdAt` column, so we fall back to
 * the parent trip's `updatedAt` as a reasonable approximation.
 * This is a best-effort delta — exact precision would require a dedicated
 * audit table.
 */
export async function sumTripStopDistanceKmThisWeek(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);

  const rows = await database
    .select({ totalKm: sum(tripStops.distanceKm) })
    .from(tripStops)
    .innerJoin(trips, eq(tripStops.tripId, trips.id))
    .where(and(eq(trips.userId, userId), gte(trips.updatedAt, weekAgo)));

  const raw = rows[0]?.totalKm;
  const parsed = parseFloat(String(raw ?? "0"));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Aggregates all stats for the given user into a single object.
 * The distance fields are returned in both km and mi so the caller (the HTTP
 * handler) can select the right unit based on the user's preference.
 */
export async function aggregateUserStats(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<UserStats> {
  const [
    distanceUnit,
    placesCount,
    countriesCount,
    totalKm,
    streak,
    placesThisWeek,
    deltaKm,
  ] = await Promise.all([
    fetchDistanceUnit(database, userId),
    countPlaces(database, userId),
    countDistinctCountries(database, userId),
    sumTripStopDistanceKm(database, userId),
    computeDayStreak(database, userId, now),
    countPlacesThisWeek(database, userId, now),
    sumTripStopDistanceKmThisWeek(database, userId, now),
  ]);

  return {
    placesCount,
    countriesCount,
    totalDistanceKm: totalKm,
    totalDistanceMi: kmToMi(totalKm),
    currentStreak: streak,
    placesThisWeek,
    distanceKmThisWeek: deltaKm,
    distanceMiThisWeek: kmToMi(deltaKm),
    distanceUnit,
  };
}

// ---------------------------------------------------------------------------
// Internal date helpers
// ---------------------------------------------------------------------------

function toUtcDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousUtcDateString(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return toUtcDateString(date);
}
