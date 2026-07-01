import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { notifications } from "../../db/schema";
import { requireUser } from "../../utils/auth";

const NOTIFICATIONS_LIMIT = 50;

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  const rows = await database
    .select({
      id: notifications.id,
      type: notifications.type,
      tone: notifications.tone,
      body: notifications.body,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(NOTIFICATIONS_LIMIT);

  return { notifications: rows };
});
