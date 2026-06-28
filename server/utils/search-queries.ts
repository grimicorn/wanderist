import { ilike, eq, or, and } from "drizzle-orm";
import { getDb } from "../db/index";
import { places, trips, entries, users, userPreferences } from "../db/schema";

const SEARCH_RESULT_LIMIT = 5;

export interface PlaceResult {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  category: string | null;
}

export interface TripResult {
  id: string;
  name: string;
  status: string;
}

export interface EntryResult {
  id: string;
  title: string;
  body: string | null;
}

export interface PersonResult {
  id: string;
  displayName: string | null;
  handle: string | null;
  email: string;
}

export interface SearchResults {
  places: PlaceResult[];
  trips: TripResult[];
  entries: EntryResult[];
  people: PersonResult[];
}

function buildSearchPattern(query: string): string {
  // Escape any SQL LIKE special characters in the user-supplied string so the
  // ILIKE pattern is treated as a literal substring match, not a wildcard.
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  return `%${escaped}%`;
}

export async function searchPlaces(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<PlaceResult[]> {
  return database
    .select({
      id: places.id,
      name: places.name,
      subtitle: places.subtitle,
      country: places.country,
      category: places.category,
    })
    .from(places)
    .where(
      and(
        eq(places.userId, userId),
        or(ilike(places.name, pattern), ilike(places.country, pattern)),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchTrips(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<TripResult[]> {
  return database
    .select({
      id: trips.id,
      name: trips.name,
      status: trips.status,
    })
    .from(trips)
    .where(and(eq(trips.userId, userId), ilike(trips.name, pattern)))
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchEntries(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<EntryResult[]> {
  return database
    .select({
      id: entries.id,
      title: entries.title,
      body: entries.body,
    })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        or(ilike(entries.title, pattern), ilike(entries.body, pattern)),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchPeople(
  database: ReturnType<typeof getDb>,
  pattern: string,
): Promise<PersonResult[]> {
  // People results are public profiles only (publicProfile = true), never
  // scoped to the requesting user so the current user can discover others.
  return database
    .select({
      id: users.id,
      displayName: userPreferences.displayName,
      handle: userPreferences.handle,
      email: users.email,
    })
    .from(users)
    .innerJoin(userPreferences, eq(users.id, userPreferences.userId))
    .where(
      and(
        eq(userPreferences.publicProfile, true),
        or(
          ilike(userPreferences.displayName, pattern),
          ilike(userPreferences.handle, pattern),
        ),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function runSearch(
  userId: string,
  rawQuery: string,
): Promise<SearchResults> {
  const database = getDb();
  const pattern = buildSearchPattern(rawQuery);

  const [placesRows, tripsRows, entriesRows, peopleRows] = await Promise.all([
    searchPlaces(database, userId, pattern),
    searchTrips(database, userId, pattern),
    searchEntries(database, userId, pattern),
    searchPeople(database, pattern),
  ]);

  return {
    places: placesRows,
    trips: tripsRows,
    entries: entriesRows,
    people: peopleRows,
  };
}
