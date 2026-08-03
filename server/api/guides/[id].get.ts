import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { requireRouterParam } from "../../utils/db-helpers";
import { loadReadableGuide } from "../../utils/guide-queries";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");
  const userId = requireUser(event);
  const database = getDb();

  // Returns the full guide row (including body) subject to the visibility
  // rule — owner reads any, non-owner reads public only, otherwise 404.
  return loadReadableGuide(database, id, userId);
});
