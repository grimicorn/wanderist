import { eq, and } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { requireUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { places } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();
  const query = getQuery(event);

  const filters: SQL[] = [eq(places.userId, userId)];

  const categoryFilter = query.category;
  if (typeof categoryFilter === "string" && categoryFilter.trim() !== "") {
    filters.push(eq(places.category, categoryFilter));
  }

  const rows = await database
    .select()
    .from(places)
    .where(and(...filters));

  return rows;
});
