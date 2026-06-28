import { eq, asc, count } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips, tripStops, entries, entryPhotos } from "../../db/schema";
import { loadOwnedOrThrow } from "../../utils/db-helpers";

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
  database: ReturnType<typeof import("../../db/index").getDb>,
  tripId: string,
): Promise<TripStop[]> {
  return database
    .select()
    .from(tripStops)
    .where(eq(tripStops.tripId, tripId))
    .orderBy(asc(tripStops.sortOrder));
}

async function fetchPhotoCount(
  database: ReturnType<typeof import("../../db/index").getDb>,
  tripId: string,
): Promise<number> {
  const rows = await database
    .select({ total: count(entryPhotos.id) })
    .from(entryPhotos)
    .innerJoin(entries, eq(entryPhotos.entryId, entries.id))
    .where(eq(entries.tripId, tripId));

  return rows[0]?.total ?? 0;
}

function computeFacts(
  trip: Trip,
  stops: TripStop[],
  photoCount: number,
): TripFacts {
  const loggedDistanceKm = stops.reduce<number | null>((accumulator, stop) => {
    if (stop.distanceKm === null || stop.distanceKm === undefined) {
      return accumulator;
    }

    return (accumulator ?? 0) + stop.distanceKm;
  }, null);

  const nights = stops.reduce<number | null>((accumulator, stop) => {
    if (stop.nights === null || stop.nights === undefined) {
      return accumulator;
    }

    return (accumulator ?? 0) + stop.nights;
  }, null);

  return {
    distanceKm: trip.distanceKm ?? null,
    loggedDistanceKm,
    nights,
    photoCount,
    stopCount: stops.length,
  };
}

export default defineEventHandler(
  async (event): Promise<TripDetailResponse> => {
    const tripId = getRouterParam(event, "id");

    if (!tripId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Trip id is required",
      });
    }

    const trip = await loadOwnedOrThrow<Trip>(
      event,
      trips,
      trips.id,
      trips.userId,
      tripId,
    );

    const database = getDb();

    const [stops, photoCount] = await Promise.all([
      fetchOrderedStops(database, tripId),
      fetchPhotoCount(database, tripId),
    ]);

    const facts = computeFacts(trip, stops, photoCount);

    return { trip, stops, facts };
  },
);
