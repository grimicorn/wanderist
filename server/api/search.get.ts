import { requireUser } from "../utils/auth";
import { runSearch } from "../utils/search-queries";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 100;

const EMPTY_RESULTS = { places: [], trips: [], entries: [], people: [] };

function isValidQuery(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_QUERY_LENGTH && trimmed.length <= MAX_QUERY_LENGTH
  );
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const query = getQuery(event);

  if (!isValidQuery(query.q)) {
    return EMPTY_RESULTS;
  }

  return runSearch(userId, query.q.trim());
});
