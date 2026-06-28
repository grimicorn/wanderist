import { eq, asc, count } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips, tripStops, entries, entryPhotos } from "../../db/schema";
import { requireTripId, loadOwnedTrip } from "../../utils/trip-helpers";

type Database = ReturnType<typeof getDb>;
type Trip = typeof trips.$inferSelect;
type TripStop = typeof tripStops.$inferSelect;

interface TripFacts {
  distanceKm: number | null;
  loggedDistanceKm: number | null;
  nights: number | null;
  photoCount: number;
  stopCount: number;
}

interface TripDetailResponse {
  trip: Trip;
  stops: TripStop[];
  facts: TripFacts;
}

async function fetchOrderedStops(
  database: Database,
  tripId: string,
): Promise<TripStop[]> {
  return database
    .select()
    .from(tripStops)
    .where(eq(tripStops.tripId, tripId))
    .orderBy(asc(tripStops.sortOrder));
}

async function fetchPhotoCount(
  database: Database,
  tripId: string,
): Promise<number> {
  const rows = await database
    .select({ total: count(entryPhotos.id) })
    .from(entryPhotos)
    .innerJoin(entries, eq(entryPhotos.entryId, entries.id))
    .where(eq(entries.tripId, tripId));

  return rows[0]?.total ?? 0;
}

function sumNullableField<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T,
): number | null {
  return items.reduce<number | null>((accumulator, item) => {
    const value = item[key];

    if (value === null || value === undefined) {
      return accumulator;
    }

    return (accumulator ?? 0) + (value as number);
  }, null);
}

function computeFacts(
  trip: Trip,
  stops: TripStop[],
  photoCount: number,
): TripFacts {
  return {
    distanceKm: trip.distanceKm ?? null,
    loggedDistanceKm: sumNullableField(stops, "distanceKm"),
    nights: sumNullableField(stops, "nights"),
    photoCount,
    stopCount: stops.length,
  };
}

export default defineEventHandler(
  async (event): Promise<TripDetailResponse> => {
    const tripId = requireTripId(event);

    const trip = await loadOwnedTrip(event, tripId);

    const database = getDb();

    const [stops, photoCount] = await Promise.all([
      fetchOrderedStops(database, tripId),
      fetchPhotoCount(database, tripId),
    ]);

    const facts = computeFacts(trip, stops, photoCount);

    return { trip, stops, facts };
  },
);
