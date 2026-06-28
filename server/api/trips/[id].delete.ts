import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips } from "../../db/schema";
import { assertOwnership } from "../../utils/db-helpers";

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, "id");

  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Trip id is required",
    });
  }

  await assertOwnership(event, trips, trips.id, trips.userId, tripId);

  const database = getDb();

  await database.delete(trips).where(eq(trips.id, tripId));

  return { ok: true };
});
