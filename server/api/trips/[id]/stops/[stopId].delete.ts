import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { trips, tripStops } from "../../../../db/schema";
import { loadOwnedOrThrow } from "../../../../utils/db-helpers";

type Trip = typeof trips.$inferSelect;

export default defineEventHandler(async (event) => {
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

  // Verify the stop belongs to this trip before deleting
  const database = getDb();
  const existingStop = await database
    .select({ id: tripStops.id })
    .from(tripStops)
    .where(and(eq(tripStops.id, stopId), eq(tripStops.tripId, tripId)))
    .limit(1);

  if (!existingStop[0]) {
    throw createError({ statusCode: 404, statusMessage: "Stop not found" });
  }

  await database.delete(tripStops).where(eq(tripStops.id, stopId));

  return { ok: true };
});
