import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips } from "../../db/schema";
import { requireTripId, loadOwnedTrip } from "../../utils/trip-helpers";
import { deleteMediaIfUnreferenced } from "../../utils/coverImageCleanup";

type Trip = typeof trips.$inferSelect;
type Database = ReturnType<typeof getDb>;

// Best-effort: a failed cover cleanup must not fail an otherwise-successful
// trip deletion. The old media is only orphaned, not corrupt, so we log and
// move on rather than surfacing a 500 to the user. Runs after the trip row is
// gone so the reference check does not see the trip that just released it.
async function cleanupCoverMedia(
  database: Database,
  trip: Trip,
): Promise<void> {
  const mediaId = trip.coverImageId;

  if (mediaId === null) {
    return;
  }

  try {
    await deleteMediaIfUnreferenced(database, trip.userId, mediaId);
  } catch (cleanupError) {
    console.error(
      `trip delete: cover image cleanup failed for ${mediaId}`,
      cleanupError,
    );
  }
}

export default defineEventHandler(async (event) => {
  const tripId = requireTripId(event);

  const existing = await loadOwnedTrip(event, tripId);

  const database = getDb();

  await database.delete(trips).where(eq(trips.id, tripId));

  // DELETE is idempotent: if the trip was already removed between the ownership
  // load and here, the delete is a no-op and we still run cleanup and return ok.
  // Cleanup stays safe because deleteMediaIfUnreferenced re-checks live
  // references and no-ops on an already-deleted media row (unlike the PATCH
  // path, which must 404 so it never cleans up media for an update that never
  // landed).
  await cleanupCoverMedia(database, existing);

  return { ok: true };
});
