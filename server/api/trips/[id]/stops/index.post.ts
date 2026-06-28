import { eq, max } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { trips, tripStops, TRIP_STOP_STATUS } from "../../../../db/schema";
import { loadOwnedOrThrow } from "../../../../utils/db-helpers";
import { requireString, optionalString } from "../../../../utils/db-helpers";
import {
  parseEnum,
  parseOptionalDate,
  parseOptionalInt,
  parseOptionalFloat,
} from "../../../../utils/validation";

type Trip = typeof trips.$inferSelect;
type TripStop = typeof tripStops.$inferSelect;

const VALID_STOP_STATUSES = [
  TRIP_STOP_STATUS.DONE,
  TRIP_STOP_STATUS.NEXT,
  TRIP_STOP_STATUS.PLANNED,
] as const;

async function getNextSortOrder(
  database: ReturnType<typeof import("../../../../db/index").getDb>,
  tripId: string,
): Promise<number> {
  const rows = await database
    .select({ maxOrder: max(tripStops.sortOrder) })
    .from(tripStops)
    .where(eq(tripStops.tripId, tripId));

  const currentMax = rows[0]?.maxOrder;
  return currentMax !== null && currentMax !== undefined ? currentMax + 1 : 0;
}

export default defineEventHandler(async (event): Promise<TripStop> => {
  const tripId = getRouterParam(event, "id");

  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Trip id is required",
    });
  }

  await loadOwnedOrThrow<Trip>(event, trips, trips.id, trips.userId, tripId);

  const body = await readBody(event);

  requireString(body?.name, "name");

  const name = body.name as string;
  const status = parseEnum(
    body.status,
    VALID_STOP_STATUSES,
    "status",
    TRIP_STOP_STATUS.PLANNED,
  );
  const arriveDate = parseOptionalDate(body.arriveDate, "arriveDate");
  const nights = parseOptionalInt(body.nights, "nights");
  const distanceKm = parseOptionalFloat(body.distanceKm, "distanceKm");
  const note = optionalString(body.note, "note");
  const placeId = optionalString(body.placeId, "placeId");

  const database = getDb();
  const sortOrder = await getNextSortOrder(database, tripId);

  const newStop = {
    id: crypto.randomUUID(),
    tripId,
    name,
    status,
    sortOrder,
    arriveDate: arriveDate ?? null,
    nights: nights !== undefined ? nights : null,
    distanceKm: distanceKm !== undefined ? distanceKm : null,
    note: note ?? null,
    placeId: placeId ?? null,
  };

  const [inserted] = await database
    .insert(tripStops)
    .values(newStop)
    .returning();

  return inserted;
});
