import { eq } from "drizzle-orm";
import { ensureUser } from "../utils/auth";
import { getDb } from "../db/index";
import { userPreferences, DISTANCE_UNIT } from "../db/schema";
import type { PreferencesDto } from "./preferences.patch";

const PREFERENCES_DTO_DEFAULTS: PreferencesDto = {
  distanceUnit: DISTANCE_UNIT.MI,
  defaultMapStyle: "outdoors",
  publicProfile: false,
  preciseLocation: false,
  showOnExplore: true,
  displayName: null,
  handle: null,
  homeBase: null,
  bio: null,
};

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();

  const rows = await database
    .select({
      distanceUnit: userPreferences.distanceUnit,
      defaultMapStyle: userPreferences.defaultMapStyle,
      publicProfile: userPreferences.publicProfile,
      preciseLocation: userPreferences.preciseLocation,
      showOnExplore: userPreferences.showOnExplore,
      displayName: userPreferences.displayName,
      handle: userPreferences.handle,
      homeBase: userPreferences.homeBase,
      bio: userPreferences.bio,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return PREFERENCES_DTO_DEFAULTS;
  }

  return rows[0];
});
