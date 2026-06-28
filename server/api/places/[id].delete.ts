import { eq } from "drizzle-orm";
import { assertOwnership } from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { places } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  await assertOwnership(event, places, places.id, places.userId, id);

  const database = getDb();

  await database.delete(places).where(eq(places.id, id));

  return { success: true };
});
