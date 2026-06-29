import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { fetchFeaturedTrips } from "../../utils/discover-queries";

export default defineEventHandler(async (event) => {
  requireUser(event);
  const database = getDb();
  return fetchFeaturedTrips(database);
});
