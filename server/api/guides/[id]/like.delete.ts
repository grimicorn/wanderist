import { eq, sql } from "drizzle-orm";
import {
  loadOwnedOrThrow,
  requireRouterParam,
} from "../../../utils/db-helpers";
import { getDb } from "../../../db/index";
import { guides } from "../../../db/schema";

const MIN_LIKE_COUNT = 0;

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  const guide = await loadOwnedOrThrow<typeof guides.$inferSelect>(
    event,
    guides,
    guides.id,
    guides.userId,
    id,
  );

  if (guide.likeCount <= MIN_LIKE_COUNT) {
    return guide;
  }

  const database = getDb();

  const updated = await database
    .update(guides)
    .set({
      likeCount: sql`GREATEST(${guides.likeCount} - 1, ${MIN_LIKE_COUNT})`,
    })
    .where(eq(guides.id, id))
    .returning();

  // See like.post.ts — 404 on an empty returning() (guide deleted between the
  // load and the update) instead of returning undefined into the store.
  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "Guide not found" });
  }

  return updated[0];
});
