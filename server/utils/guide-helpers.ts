/**
 * Shared validation for guide route handlers.
 *
 * Centralises the readTimeMinutes floor check and body normalisation so
 * POST /api/guides and PATCH /api/guides/:id can't drift out of sync on what
 * counts as a valid read time or how an empty body is stored.
 */
import { optionalString } from "./db-helpers";
import { parseOptionalInt } from "./validation";

// A guide with a 0-minute read time isn't meaningful; the schema's default of
// 5 already implies "at least 1", this just enforces it on explicit input.
export const MIN_READ_TIME_MINUTES = 1;

// A day of continuous reading is already an absurd upper bound. This mainly
// exists so a wildly out-of-range value 400s here with a clear message
// instead of reaching Postgres and erroring on the int4 column's own range
// limit (read_time_minutes is a plain `integer` — see server/db/schema.ts).
export const MAX_READ_TIME_MINUTES = 1440;

export function parseReadTimeMinutes(value: unknown): number | undefined {
  const readTimeMinutes = parseOptionalInt(value, "readTimeMinutes");

  if (readTimeMinutes === undefined) {
    return undefined;
  }

  // parseOptionalInt also returns `null` for an explicit `readTimeMinutes:
  // null` (its "clear this field" signal for nullable columns), but this
  // column is NOT NULL — treat that the same as "invalid", not "no value",
  // so it 400s here instead of reaching the database as a null write.
  const isOutOfRange =
    readTimeMinutes === null ||
    readTimeMinutes < MIN_READ_TIME_MINUTES ||
    readTimeMinutes > MAX_READ_TIME_MINUTES;

  if (isOutOfRange) {
    throw createError({
      statusCode: 400,
      statusMessage: `readTimeMinutes must be an integer between ${MIN_READ_TIME_MINUTES} and ${MAX_READ_TIME_MINUTES}`,
    });
  }

  return readTimeMinutes;
}

/**
 * Reads the optional `body` field and normalises it so a guide never ends up
 * with an empty string sitting in a nullable column alongside real `null`
 * values (two representations of "no body" otherwise exist side by side):
 * - key absent OR explicit `null` -> `undefined` (POST treats this as "no
 *   body"; PATCH's `setIfDefined` treats this as "don't touch the existing
 *   body" — `optionalString` doesn't distinguish "absent" from "explicit
 *   null", matching every other optional string field in this codebase, so
 *   there's no way to explicitly clear body via `null`; send `""` instead)
 * - present but blank/whitespace-only string -> `null` ("clear the body")
 * - present with content -> the trimmed string
 */
export function parseOptionalGuideBody(
  value: unknown,
): string | null | undefined {
  const stringValue = optionalString(value, "body");

  if (stringValue === undefined) {
    return undefined;
  }

  const trimmed = stringValue.trim();

  return trimmed ? trimmed : null;
}
