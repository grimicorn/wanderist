import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/index";
import { guides } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { GUIDE_LIKEABLE, likedContentIds } from "../../utils/like-helpers";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  const rows = await database
    .select()
    .from(guides)
    .where(eq(guides.userId, userId))
    .orderBy(desc(guides.createdAt));

  const likedIds = await likedContentIds(
    database,
    GUIDE_LIKEABLE,
    rows.map((row) => row.id),
    userId,
  );

  return rows.map((row) => ({
    ...row,
    likedByCurrentUser: likedIds.has(row.id),
  }));
});
