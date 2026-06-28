import { eq } from "drizzle-orm";
import { assertOwnership, requireRouterParam } from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { entries } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(event, entries, entries.id, entries.userId, id);

  const database = getDb();

  await database.delete(entries).where(eq(entries.id, id));

  return { success: true };
});
