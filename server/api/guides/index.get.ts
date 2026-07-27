import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/index";
import { guides } from "../../db/schema";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  const rows = await database
    .select()
    .from(guides)
    .where(eq(guides.userId, userId))
    .orderBy(desc(guides.createdAt));

  return rows;
});
