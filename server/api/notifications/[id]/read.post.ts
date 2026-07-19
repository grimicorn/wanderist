import { eq } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { notifications } from "../../../db/schema";
import { assertOwnership, requireRouterParam } from "../../../utils/db-helpers";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(
    event,
    notifications,
    notifications.id,
    notifications.userId,
    id,
  );

  const database = getDb();

  await database
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));

  return { ok: true };
});
