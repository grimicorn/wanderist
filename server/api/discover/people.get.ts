import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { fetchSuggestedPeople } from "../../utils/discover-queries";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();
  return fetchSuggestedPeople(database, userId);
});
