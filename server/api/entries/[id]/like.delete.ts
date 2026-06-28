import { eq, sql } from "drizzle-orm";
import {
  loadOwnedOrThrow,
  requireRouterParam,
} from "../../../utils/db-helpers";
import { getDb } from "../../../db/index";
import { entries } from "../../../db/schema";

const MIN_LIKE_COUNT = 0;

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  const entry = await loadOwnedOrThrow<typeof entries.$inferSelect>(
    event,
    entries,
    entries.id,
    entries.userId,
    id,
  );

  if (entry.likeCount <= MIN_LIKE_COUNT) {
    return entry;
  }

  const database = getDb();

  const updated = await database
    .update(entries)
    .set({
      likeCount: sql`GREATEST(${entries.likeCount} - 1, ${MIN_LIKE_COUNT})`,
    })
    .where(eq(entries.id, id))
    .returning();

  return updated[0];
});
