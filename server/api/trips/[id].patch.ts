import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips, TRIP_STATUS, VISIBILITY } from "../../db/schema";
import { loadOwnedOrThrow } from "../../utils/db-helpers";
import { optionalString } from "../../utils/db-helpers";
import { parseOptionalEnum, parseOptionalDate } from "../../utils/validation";

type Trip = typeof trips.$inferSelect;

const VALID_STATUSES = [
  TRIP_STATUS.ONGOING,
  TRIP_STATUS.UPCOMING,
  TRIP_STATUS.PAST,
] as const;

const VALID_VISIBILITIES = [VISIBILITY.PRIVATE, VISIBILITY.PUBLIC] as const;

function buildPatchFields(body: Record<string, unknown>) {
  const fields: Partial<typeof trips.$inferInsert> = {};

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

  const status = parseOptionalEnum(body.status, VALID_STATUSES, "status");
  if (status !== undefined) {
    fields.status = status;
  }

  const visibility = parseOptionalEnum(
    body.visibility,
    VALID_VISIBILITIES,
    "visibility",
  );
  if (visibility !== undefined) {
    fields.visibility = visibility;
  }

  const startDate = parseOptionalDate(body.startDate, "startDate");
  if (startDate !== undefined) {
    fields.startDate = startDate;
  }

  const endDate = parseOptionalDate(body.endDate, "endDate");
  if (endDate !== undefined) {
    fields.endDate = endDate;
  }

  return fields;
}

export default defineEventHandler(async (event): Promise<Trip> => {
  const tripId = getRouterParam(event, "id");

  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Trip id is required",
    });
  }

  await loadOwnedOrThrow<Trip>(event, trips, trips.id, trips.userId, tripId);

  const body = await readBody(event);
  const patchFields = buildPatchFields(body ?? {});

  const patchStart = patchFields.startDate;
  const patchEnd = patchFields.endDate;

  if (patchStart && patchEnd && patchEnd < patchStart) {
    throw createError({
      statusCode: 400,
      statusMessage: "endDate must be on or after startDate",
    });
  }

  if (Object.keys(patchFields).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided to update",
    });
  }

  const database = getDb();

  const [updated] = await database
    .update(trips)
    .set(patchFields)
    .where(eq(trips.id, tripId))
    .returning();

  return updated;
});
