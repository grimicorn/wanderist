import { eq } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { tripStops } from "../../../../db/schema";
import {
  requireTripId,
  requireStopId,
  loadOwnedTrip,
  loadTripStop,
} from "../../../../utils/trip-helpers";

export default defineEventHandler(async (event) => {
  const tripId = requireTripId(event);
  const stopId = requireStopId(event);

  await loadOwnedTrip(event, tripId);

  const database = getDb();

  await loadTripStop(database, tripId, stopId);

  await database.delete(tripStops).where(eq(tripStops.id, stopId));

  return { ok: true };
});
