import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { notifications } from "../../db/schema";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  await database
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );

  return { ok: true };
});
