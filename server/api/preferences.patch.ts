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

const STRING_FIELD_MAX_LENGTHS: Record<string, number> = {
  displayName: 100,
  handle: 50,
  homeBase: 100,
  bio: 500,
};

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

type PatchResult = {
  distanceUnit?: (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];
  defaultMapStyle?: ValidMapStyle;
  publicProfile?: boolean;
  preciseLocation?: boolean;
  showOnExplore?: boolean;
  displayName?: string | null;
  handle?: string | null;
  homeBase?: string | null;
  bio?: string | null;
};

function validateDistanceUnit(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  if (body.distanceUnit === undefined) {
    return;
  }
  if (!isValidDistanceUnit(body.distanceUnit)) {
    throw createError({
      statusCode: 400,
      statusMessage: `distanceUnit must be "mi" or "km"`,
    });
  }
  patch.distanceUnit = body.distanceUnit;
}

function validateMapStyle(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  if (body.defaultMapStyle === undefined) {
    return;
  }
  if (!isValidMapStyle(body.defaultMapStyle)) {
    throw createError({
      statusCode: 400,
      statusMessage: `defaultMapStyle must be one of: ${VALID_MAP_STYLES.join(", ")}`,
    });
  }
  patch.defaultMapStyle = body.defaultMapStyle;
}

function validateBooleanFields(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  const booleanFields = [
    "publicProfile",
    "preciseLocation",
    "showOnExplore",
  ] as const;

  for (const field of booleanFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (!isOptionalBoolean(body[field])) {
      throw createError({
        statusCode: 400,
        statusMessage: `${field} must be a boolean`,
      });
    }
    if (body[field] === null) {
      continue;
    }
    patch[field] = body[field] as boolean;
  }
}

function validateStringFields(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  const stringFields = ["displayName", "handle", "homeBase", "bio"] as const;

  for (const field of stringFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (body[field] === null) {
      patch[field] = null;
      continue;
    }
    const value = optionalString(body[field], field);
    if (value === undefined) {
      continue;
    }
    const maxLength = STRING_FIELD_MAX_LENGTHS[field];
    if (maxLength !== undefined && value.length > maxLength) {
      throw createError({
        statusCode: 400,
        statusMessage: `${field} must be at most ${maxLength} characters`,
      });
    }
    patch[field] = value;
  }
}

function validatePatch(body: Record<string, unknown>): PatchResult {
  const patch: PatchResult = {};
  validateDistanceUnit(body, patch);
  validateMapStyle(body, patch);
  validateBooleanFields(body, patch);
  validateStringFields(body, patch);
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

  try {
    await database
      .insert(userPreferences)
      .values({ userId, ...patch })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: patch,
      });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: "handle is already taken",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save preferences",
    });
  }

  const rows = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return rows[0];
});

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const errorObj = error as Record<string, unknown>;
  const message = typeof errorObj.message === "string" ? errorObj.message : "";
  return message.includes("unique") || message.includes("duplicate");
}
