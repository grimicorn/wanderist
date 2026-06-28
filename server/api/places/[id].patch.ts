import { eq } from "drizzle-orm";
import {
  assertOwnership,
  optionalString,
  optionalLatitude,
  optionalLongitude,
  requireRouterParam,
} from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { places } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(event, places, places.id, places.userId, id);

  const database = getDb();
  const body = await readBody(event);

  const updates: Partial<typeof places.$inferInsert> = {};

  const name = optionalString(body?.name, "name");
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      throw createError({
        statusCode: 400,
        statusMessage: "name must not be empty when provided",
      });
    }
    updates.name = trimmedName;
  }

  const subtitle = optionalString(body?.subtitle, "subtitle");
  if (subtitle !== undefined) {
    updates.subtitle = subtitle;
  }

  const country = optionalString(body?.country, "country");
  if (country !== undefined) {
    updates.country = country;
  }

  const category = optionalString(body?.category, "category");
  if (category !== undefined) {
    updates.category = category;
  }

  const latitude = optionalLatitude(body?.latitude);
  if (latitude !== undefined) {
    updates.latitude = latitude;
  }

  const longitude = optionalLongitude(body?.longitude);
  if (longitude !== undefined) {
    updates.longitude = longitude;
  }

  if (Object.keys(updates).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided for update",
    });
  }

  const updated = await database
    .update(places)
    .set(updates)
    .where(eq(places.id, id))
    .returning();

  return updated[0];
});
