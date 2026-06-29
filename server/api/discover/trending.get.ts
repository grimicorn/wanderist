import { getDb } from "../../db/index";
import { requireUser } from "../../utils/auth";
import { fetchTrendingPlaces } from "../../utils/discover-queries";

const VALID_CATEGORIES = [
  "nature",
  "city",
  "coast",
  "food",
  "culture",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function parseCategoryFilter(value: unknown): string | null {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "All"
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "category must be a string",
    });
  }

  const lowered = value.toLowerCase() as ValidCategory;

  if (!VALID_CATEGORIES.includes(lowered)) {
    throw createError({
      statusCode: 400,
      statusMessage: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
    });
  }

  return lowered;
}

export default defineEventHandler(async (event) => {
  requireUser(event);
  const query = getQuery(event);
  const category = parseCategoryFilter(query.category);
  const database = getDb();
  return fetchTrendingPlaces(database, category);
});
