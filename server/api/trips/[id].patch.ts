import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips, TRIP_STATUS, VISIBILITY } from "../../db/schema";
import { optionalString } from "../../utils/db-helpers";
import {
  parseOptionalEnum,
  parseOptionalDate,
  setIfDefined,
} from "../../utils/validation";
import { requireTripId, loadOwnedTrip } from "../../utils/trip-helpers";

type Trip = typeof trips.$inferSelect;
type TripPatchFields = Partial<typeof trips.$inferInsert>;

const VALID_STATUSES = [
  TRIP_STATUS.ONGOING,
  TRIP_STATUS.UPCOMING,
  TRIP_STATUS.PAST,
] as const;

const VALID_VISIBILITIES = [VISIBILITY.PRIVATE, VISIBILITY.PUBLIC] as const;

function parseName(body: Record<string, unknown>): string | undefined {
  const name = optionalString(body.name, "name");

  if (name === undefined) {
    return undefined;
  }

  const trimmed = name.trim();

  if (trimmed === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "name must be a non-empty string when provided",
    });
  }

  return trimmed;
}

function buildPatchFields(body: Record<string, unknown>): TripPatchFields {
  const fields: TripPatchFields = {};

  setIfDefined(fields, "name", parseName(body));
  setIfDefined(
    fields,
    "status",
    parseOptionalEnum(body.status, VALID_STATUSES, "status"),
  );
  setIfDefined(
    fields,
    "visibility",
    parseOptionalEnum(body.visibility, VALID_VISIBILITIES, "visibility"),
  );
  setIfDefined(
    fields,
    "startDate",
    parseOptionalDate(body.startDate, "startDate"),
  );
  setIfDefined(fields, "endDate", parseOptionalDate(body.endDate, "endDate"));

  return fields;
}

function resolveDate(
  patched: Date | null | undefined,
  existing: Date | null | undefined,
): Date | null | undefined {
  return patched === undefined ? existing : patched;
}

function validateEffectiveDateRange(
  existing: Trip,
  fields: TripPatchFields,
): void {
  const effectiveStart = resolveDate(fields.startDate, existing.startDate);
  const effectiveEnd = resolveDate(fields.endDate, existing.endDate);

  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    throw createError({
      statusCode: 400,
      statusMessage: "endDate must be on or after startDate",
    });
  }
}

function requireNonEmptyPatch(fields: TripPatchFields): void {
  if (Object.keys(fields).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided to update",
    });
  }
}

export default defineEventHandler(async (event): Promise<Trip> => {
  const tripId = requireTripId(event);

  const existing = await loadOwnedTrip(event, tripId);

  const body = await readBody(event);
  const patchFields = buildPatchFields(body ?? {});

  validateEffectiveDateRange(existing, patchFields);
  requireNonEmptyPatch(patchFields);

  const database = getDb();

  const [updated] = await database
    .update(trips)
    .set(patchFields)
    .where(eq(trips.id, tripId))
    .returning();

  return updated;
});
