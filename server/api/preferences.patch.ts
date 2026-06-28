import { eq } from "drizzle-orm";
import { ensureUser } from "../utils/auth";
import { getDb } from "../db/index";
import { userPreferences, DISTANCE_UNIT } from "../db/schema";
import { optionalString } from "../utils/db-helpers";

const VALID_MAP_STYLES = [
  "outdoors",
  "streets",
  "satellite",
  "light",
  "dark",
  "custom",
] as const;

type ValidMapStyle = (typeof VALID_MAP_STYLES)[number];

function isValidMapStyle(value: unknown): value is ValidMapStyle {
  return (
    typeof value === "string" &&
    VALID_MAP_STYLES.includes(value as ValidMapStyle)
  );
}

function isValidDistanceUnit(
  value: unknown,
): value is (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT] {
  return value === DISTANCE_UNIT.MI || value === DISTANCE_UNIT.KM;
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || value === null || typeof value === "boolean";
}

function validatePatch(body: Record<string, unknown>): {
  distanceUnit?: (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];
  defaultMapStyle?: ValidMapStyle;
  publicProfile?: boolean;
  preciseLocation?: boolean;
  showOnExplore?: boolean;
  displayName?: string;
  handle?: string;
  homeBase?: string;
  bio?: string;
} {
  const patch: ReturnType<typeof validatePatch> = {};

  if (body.distanceUnit !== undefined) {
    if (!isValidDistanceUnit(body.distanceUnit)) {
      throw createError({
        statusCode: 400,
        statusMessage: `distanceUnit must be "mi" or "km"`,
      });
    }
    patch.distanceUnit = body.distanceUnit;
  }

  if (body.defaultMapStyle !== undefined) {
    if (!isValidMapStyle(body.defaultMapStyle)) {
      throw createError({
        statusCode: 400,
        statusMessage: `defaultMapStyle must be one of: ${VALID_MAP_STYLES.join(", ")}`,
      });
    }
    patch.defaultMapStyle = body.defaultMapStyle;
  }

  const booleanFields = [
    "publicProfile",
    "preciseLocation",
    "showOnExplore",
  ] as const;

  for (const field of booleanFields) {
    if (body[field] !== undefined) {
      if (!isOptionalBoolean(body[field])) {
        throw createError({
          statusCode: 400,
          statusMessage: `${field} must be a boolean`,
        });
      }
      if (body[field] !== null) {
        patch[field] = body[field] as boolean;
      }
    }
  }

  const stringFields = ["displayName", "handle", "homeBase", "bio"] as const;

  for (const field of stringFields) {
    if (body[field] !== undefined) {
      const value = optionalString(body[field], field);
      if (value !== undefined) {
        patch[field] = value;
      }
    }
  }

  return patch;
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body must be a JSON object",
    });
  }

  const patch = validatePatch(body);

  if (Object.keys(patch).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields to update",
    });
  }

  const database = getDb();

  await database
    .insert(userPreferences)
    .values({ userId, ...patch })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: patch,
    });

  const rows = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return rows[0];
});
