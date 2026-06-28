import { eq, sql } from "drizzle-orm";
import {
  loadOwnedOrThrow,
  requireRouterParam,
} from "../../../utils/db-helpers";
import { getDb } from "../../../db/index";
import { entries } from "../../../db/schema";
import { loadEntryRelations } from "../../../utils/entry-helpers";

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

  const database = getDb();

  if (entry.likeCount <= MIN_LIKE_COUNT) {
    const relations = await loadEntryRelations(database, id);
    return { ...entry, ...relations };
  }

  const updated = await database
    .update(entries)
    .set({
      likeCount: sql`GREATEST(${entries.likeCount} - 1, ${MIN_LIKE_COUNT})`,
    })
    .where(eq(entries.id, id))
    .returning();

  const relations = await loadEntryRelations(database, id);

  return { ...updated[0], ...relations };
});
