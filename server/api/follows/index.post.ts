import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { follows, users } from "../../db/schema";
import { ensureUser } from "../../utils/auth";
import { requireString } from "../../utils/db-helpers";
import { createNotification } from "../../utils/notification-helpers";

export default defineEventHandler(async (event) => {
  // ensureUser (not requireUser) because the INSERT has a FK on follows.follower_id
  // referencing users.id. If the Clerk webhook hasn't landed yet the users row
  // may not exist, so we materialise it here before writing the follow row.
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

  await createNotification({
    userId: followeeId,
    type: "new_follower",
    tone: "accent",
    body: "Someone started following you",
  });

  return { ok: true };
});
