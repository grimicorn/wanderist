import { eq, sql } from "drizzle-orm";
import {
  loadOwnedOrThrow,
  requireRouterParam,
} from "../../../utils/db-helpers";
import { getDb } from "../../../db/index";
import { guides } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await loadOwnedOrThrow(event, guides, guides.id, guides.userId, id);

  const database = getDb();

  const updated = await database
    .update(guides)
    .set({ likeCount: sql`${guides.likeCount} + 1` })
    .where(eq(guides.id, id))
    .returning();

  // The load and the update are separate statements; if the guide is deleted
  // in between, returning() is empty. 404 rather than returning undefined the
  // store would then dereference (updated.likeCount) into a TypeError —
  // matches the same guard in guides/[id].patch.ts.
  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "Guide not found" });
  }

  return updated[0];
});
