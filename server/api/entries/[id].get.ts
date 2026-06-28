import { loadOwnedOrThrow, requireRouterParam } from "../../utils/db-helpers";
import { getDb } from "../../db/index";
import { entries } from "../../db/schema";
import { loadEntryRelations } from "../../utils/entry-helpers";

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  const entry = await loadOwnedOrThrow(
    event,
    entries,
    entries.id,
    entries.userId,
    id,
  );

  const database = getDb();
  const relations = await loadEntryRelations(database, id);

  return { ...entry, ...relations };
});
