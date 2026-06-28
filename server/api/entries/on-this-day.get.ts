import { requireUser } from "../../utils/auth";
import { fetchOnThisDayEntries } from "../../utils/on-this-day-helpers";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);

  const referenceDate = new Date();

  const entries = await fetchOnThisDayEntries(userId, referenceDate);

  return { entries };
});
