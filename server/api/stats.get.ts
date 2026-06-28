import { requireUser } from "../utils/auth";
import { getDb } from "../db/index";
import { aggregateUserStats } from "../utils/stats-queries";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();
  return aggregateUserStats(database, userId);
});
