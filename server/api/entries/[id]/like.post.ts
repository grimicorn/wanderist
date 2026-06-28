import { eq, sql } from "drizzle-orm";
import {
  loadOwnedOrThrow,
  requireRouterParam,
} from "../../../utils/db-helpers";
import { getDb } from "../../../db/index";
import { entries } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await loadOwnedOrThrow(event, entries, entries.id, entries.userId, id);

  const database = getDb();

  const updated = await database
    .update(entries)
    .set({ likeCount: sql`${entries.likeCount} + 1` })
    .where(eq(entries.id, id))
    .returning();

  return updated[0];
});
