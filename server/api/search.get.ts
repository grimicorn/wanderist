import { requireUser } from "../utils/auth";
import { runSearch } from "../utils/search-queries";

const MIN_QUERY_LENGTH = 1;

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const query = getQuery(event);

  const rawQuery = query.q;

  if (
    typeof rawQuery !== "string" ||
    rawQuery.trim().length < MIN_QUERY_LENGTH
  ) {
    return { places: [], trips: [], entries: [], people: [] };
  }

  return runSearch(userId, rawQuery.trim());
});
