import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { follows } from "../../db/schema";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const followerId = requireUser(event);
  const database = getDb();

  const rows = await database
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, followerId));

  const followingIds = rows.map((row) => row.followeeId);
  return { followingIds };
});
