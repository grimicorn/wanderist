import { eq } from "drizzle-orm";
import { assertOwnership, requireRouterParam } from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { guides } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(event, guides, guides.id, guides.userId, id);

  const database = getDb();

  await database.delete(guides).where(eq(guides.id, id));

  return { success: true };
});
