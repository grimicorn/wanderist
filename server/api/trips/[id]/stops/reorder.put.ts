import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { tripStops } from "../../../../db/schema";
import { requireTripId, loadOwnedTrip } from "../../../../utils/trip-helpers";

type Database = ReturnType<typeof getDb>;

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: "stopIds must be an array of strings",
    });
  }

  if (value.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "stopIds must not be empty",
    });
  }

  return value;
}

function requireStringItems(items: unknown[]): string[] {
  if (items.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Each stopId must be a non-empty string",
    });
  }

  return items as string[];
}

function requireUniqueItems(items: string[]): void {
  if (new Set(items).size !== items.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "stopIds must not contain duplicates",
    });
  }
}

function parseStopIds(value: unknown): string[] {
  const items = requireArray(value);
  const stringItems = requireStringItems(items);
  requireUniqueItems(stringItems);
  return stringItems;
}

async function fetchTripStopIds(
  database: Database,
  tripId: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: tripStops.id })
    .from(tripStops)
    .where(eq(tripStops.tripId, tripId));

  return rows.map((row) => row.id);
}

function validateAllStopsPresent(
  requestedIds: string[],
  existingIds: string[],
): void {
  const existingSet = new Set(existingIds);
  const missing = requestedIds.filter((id) => !existingSet.has(id));

  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Stop ids not found on this trip: ${missing.join(", ")}`,
    });
  }

  if (requestedIds.length !== existingIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Reorder list must include all ${existingIds.length} stops; received ${requestedIds.length}`,
    });
  }
}

export default defineEventHandler(async (event) => {
  const tripId = requireTripId(event);

  await loadOwnedTrip(event, tripId);

  const body = await readBody(event);
  const stopIds = parseStopIds(body?.stopIds);

  const database = getDb();
  const existingIds = await fetchTripStopIds(database, tripId);

  validateAllStopsPresent(stopIds, existingIds);

  // Note: neon-http uses HTTP connections which do not support interactive
  // transactions. Each UPDATE is issued independently. If any fails partway
  // through, earlier updates will have committed. Switching to neon-serverless
  // (WebSocket pool) would allow wrapping these in a real transaction.
  await Promise.all(
    stopIds.map((stopId, index) =>
      database
        .update(tripStops)
        .set({ sortOrder: index })
        .where(eq(tripStops.id, stopId)),
    ),
  );

  const reorderedStops = await database
    .select()
    .from(tripStops)
    .where(inArray(tripStops.id, stopIds));

  reorderedStops.sort((a, b) => stopIds.indexOf(a.id) - stopIds.indexOf(b.id));

  return reorderedStops;
});
