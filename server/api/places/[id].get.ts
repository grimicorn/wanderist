import { loadOwnedOrThrow, requireRouterParam } from "../../utils/db-helpers";
import { places } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  const place = await loadOwnedOrThrow(
    event,
    places,
    places.id,
    places.userId,
    id,
  );

  return place;
});
