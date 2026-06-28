import { eq, and, desc, asc } from "drizzle-orm";
import { getDb } from "../../db/index";
import { trips, TRIP_STATUS } from "../../db/schema";
import { requireUser } from "../../utils/auth";

const VALID_STATUSES = [
  TRIP_STATUS.ONGOING,
  TRIP_STATUS.UPCOMING,
  TRIP_STATUS.PAST,
] as const;

type TripStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: unknown): value is TripStatus {
  return VALID_STATUSES.includes(value as TripStatus);
}

function parseStatusFilter(value: unknown): TripStatus | null {
  if (value === undefined || value === null || value === "All") {
    return null;
  }

  if (!isValidStatus(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  return value;
}

const VALID_SORT_ORDERS = ["asc", "desc"] as const;

type SortOrder = (typeof VALID_SORT_ORDERS)[number];

function parseSortOrder(value: unknown): SortOrder {
  if (value === undefined || value === null) {
    return "desc";
  }

  if (!VALID_SORT_ORDERS.includes(value as SortOrder)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid sort order. Must be one of: ${VALID_SORT_ORDERS.join(", ")}`,
    });
  }

  return value as SortOrder;
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const query = getQuery(event);

  const statusFilter = parseStatusFilter(query.status);
  const sortOrder = parseSortOrder(query.sort);

  const database = getDb();

  const whereConditions = statusFilter
    ? and(eq(trips.userId, userId), eq(trips.status, statusFilter))
    : eq(trips.userId, userId);

  const orderBy =
    sortOrder === "asc" ? asc(trips.createdAt) : desc(trips.createdAt);

  const rows = await database
    .select()
    .from(trips)
    .where(whereConditions)
    .orderBy(orderBy);

  return rows;
});
