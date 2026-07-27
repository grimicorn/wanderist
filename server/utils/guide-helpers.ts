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

export function parseReadTimeMinutes(value: unknown): number | undefined {
  const readTimeMinutes = parseOptionalInt(value, "readTimeMinutes");

  if (
    readTimeMinutes !== undefined &&
    readTimeMinutes < MIN_READ_TIME_MINUTES
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `readTimeMinutes must be at least ${MIN_READ_TIME_MINUTES}`,
    });
  }

  return readTimeMinutes;
}

/**
 * Reads the optional `body` field and normalises it so a guide never ends up
 * with an empty string sitting in a nullable column alongside real `null`
 * values (two representations of "no body" otherwise exist side by side):
 * - key absent -> `undefined` (POST treats this as "no body"; PATCH's
 *   `setIfDefined` treats this as "don't touch the existing body")
 * - present but blank/whitespace-only -> `null` ("clear the body")
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
