import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { fetchNotificationsForUser } from "../../utils/notification-helpers";

const NOTIFICATIONS_LIMIT = 50;

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  const rows = await fetchNotificationsForUser(
    database,
    userId,
    NOTIFICATIONS_LIMIT,
  );

  return { notifications: rows };
});
