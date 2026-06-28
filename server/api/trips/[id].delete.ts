import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips } from "../../db/schema";
import { requireTripId, loadOwnedTrip } from "../../utils/trip-helpers";

export default defineEventHandler(async (event) => {
  const tripId = requireTripId(event);

  await loadOwnedTrip(event, tripId);

  const database = getDb();

  await database.delete(trips).where(eq(trips.id, tripId));

  return { ok: true };
});
