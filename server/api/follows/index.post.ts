import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { follows, users } from "../../db/schema";
import { ensureUser } from "../../utils/auth";
import { requireString } from "../../utils/db-helpers";

export default defineEventHandler(async (event) => {
  const followerId = await ensureUser(event);

  const body = await readBody<{ followeeId?: unknown }>(event);
  requireString(body?.followeeId, "followeeId");

  const followeeId = body.followeeId as string;

  if (followerId === followeeId) {
    throw createError({
      statusCode: 422,
      statusMessage: "Cannot follow yourself",
    });
  }

  const database = getDb();

  const followeeRows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followeeId))
    .limit(1);

  if (followeeRows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  await database
    .insert(follows)
    .values({ followerId, followeeId })
    .onConflictDoNothing();

  // TODO(#24): emit a new-follower notification to followeeId here once the
  // notifications backend is implemented.

  return { ok: true };
});
