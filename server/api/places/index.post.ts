import { ensureUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { places } from "../../db/schema";
import {
  requireString,
  optionalString,
  optionalLatitude,
  optionalLongitude,
} from "../../utils/db-helpers";

function generateId(): string {
  return crypto.randomUUID();
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();
  const body = await readBody(event);

  requireString(body?.name, "name");
  const name = (body.name as string).trim();

  const subtitle = optionalString(body?.subtitle, "subtitle");
  const country = optionalString(body?.country, "country");
  const category = optionalString(body?.category, "category");
  const latitude = optionalLatitude(body?.latitude);
  const longitude = optionalLongitude(body?.longitude);

  const id = generateId();

  const inserted = await database
    .insert(places)
    .values({
      id,
      userId,
      name,
      subtitle,
      country,
      category,
      latitude,
      longitude,
    })
    .returning();

  return inserted[0];
});
