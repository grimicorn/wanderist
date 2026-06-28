import { eq } from "drizzle-orm";
import { ensureUser } from "../utils/auth";
import { getDb } from "../db/index";
import { userPreferences } from "../db/schema";

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();

  const rows = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return {
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
      displayName: null,
      handle: null,
      homeBase: null,
      bio: null,
    };
  }

  return rows[0];
});
