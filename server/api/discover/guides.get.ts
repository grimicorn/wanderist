import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { fetchGuides } from "../../utils/discover-queries";

export default defineEventHandler(async (event) => {
  requireUser(event);
  const database = getDb();
  return fetchGuides(database);
});
