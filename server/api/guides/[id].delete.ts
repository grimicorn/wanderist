import { and, eq } from "drizzle-orm";
import { assertOwnership, requireRouterParam } from "../../utils/db-helpers";
import { requireUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { guides } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  // assertOwnership already resolves and validates the authenticated user;
  // requireUser here is a second, cheap read of event.context (no extra
  // query) so the delete below can be scoped to the owner directly rather
  // than relying solely on the preceding check.
  await assertOwnership(event, guides, guides.id, guides.userId, id);
  const userId = requireUser(event);

  const database = getDb();

  // Unlike the PATCH handler, this doesn't check whether a row was actually
  // removed before reporting success: a delete racing with another delete of
  // the same row (e.g. a double click) is treated as idempotent, matching
  // server/api/places/[id].delete.ts and server/api/trips/[id].delete.ts.
  // PATCH's race guard exists because returning `undefined` there would
  // otherwise surface as a corrupt 200 body; DELETE has no equivalent risk.
  await database
    .delete(guides)
    .where(and(eq(guides.id, id), eq(guides.userId, userId)));

  return { success: true };
});
