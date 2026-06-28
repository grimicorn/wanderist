import { loadOwnedOrThrow } from "../../utils/db-helpers";
import { places } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const place = await loadOwnedOrThrow(
    event,
    places,
    places.id,
    places.userId,
    id,
  );

  return place;
});
