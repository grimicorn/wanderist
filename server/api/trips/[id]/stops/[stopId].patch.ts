import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { trips, tripStops, TRIP_STOP_STATUS } from "../../../../db/schema";
import { loadOwnedOrThrow } from "../../../../utils/db-helpers";
import { optionalString } from "../../../../utils/db-helpers";
import {
  parseOptionalEnum,
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

function buildPatchFields(body: Record<string, unknown>) {
  const fields: Partial<typeof tripStops.$inferInsert> = {};

  const name = optionalString(body.name, "name");
  if (name !== undefined) {
    if (name.trim() === "") {
      throw createError({
        statusCode: 400,
        statusMessage: "name must be a non-empty string when provided",
      });
    }

    fields.name = name;
  }

  const status = parseOptionalEnum(body.status, VALID_STOP_STATUSES, "status");
  if (status !== undefined) {
    fields.status = status;
  }

  const arriveDate = parseOptionalDate(body.arriveDate, "arriveDate");
  if (arriveDate !== undefined) {
    fields.arriveDate = arriveDate;
  }

  const nights = parseOptionalInt(body.nights, "nights");
  if (nights !== undefined) {
    fields.nights = nights;
  }

  const distanceKm = parseOptionalFloat(body.distanceKm, "distanceKm");
  if (distanceKm !== undefined) {
    fields.distanceKm = distanceKm;
  }

  const note = optionalString(body.note, "note");
  if (note !== undefined) {
    fields.note = note;
  }

  const placeId = optionalString(body.placeId, "placeId");
  if (placeId !== undefined) {
    fields.placeId = placeId;
  }

  return fields;
}

export default defineEventHandler(async (event): Promise<TripStop> => {
  const tripId = getRouterParam(event, "id");
  const stopId = getRouterParam(event, "stopId");

  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Trip id is required",
    });
  }

  if (!stopId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Stop id is required",
    });
  }

  // Verify trip ownership first
  await loadOwnedOrThrow<Trip>(event, trips, trips.id, trips.userId, tripId);

  // Verify the stop belongs to this trip
  const database = getDb();
  const existingStop = await database
    .select()
    .from(tripStops)
    .where(and(eq(tripStops.id, stopId), eq(tripStops.tripId, tripId)))
    .limit(1);

  if (!existingStop[0]) {
    throw createError({ statusCode: 404, statusMessage: "Stop not found" });
  }

  const body = await readBody(event);
  const patchFields = buildPatchFields(body ?? {});

  if (Object.keys(patchFields).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided to update",
    });
  }

  const [updated] = await database
    .update(tripStops)
    .set(patchFields)
    .where(eq(tripStops.id, stopId))
    .returning();

  return updated;
});
