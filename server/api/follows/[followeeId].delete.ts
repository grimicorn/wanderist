import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { follows } from "../../db/schema";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const followerId = requireUser(event);
  const followeeId = getRouterParam(event, "followeeId");

  if (!followeeId) {
    throw createError({
      statusCode: 400,
      statusMessage: "followeeId is required",
    });
  }

  const database = getDb();

  await database
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followeeId, followeeId),
      ),
    );

  return { ok: true };
});
