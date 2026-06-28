/**
 * Shared input validation helpers for Nitro server handlers.
 *
 * Each helper accepts an unknown value from a request body/query, validates it,
 * and either returns the typed value or throws a 400 H3 error. Keeping these
 * here avoids duplicating the same validation logic across handlers.
 */

/**
 * Validates that `value` is a member of the given `allowed` enum array.
 * Returns the typed enum value or throws 400. Pass `defaultValue` for fields
 * that should have a default when `value` is absent.
 */
export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
  defaultValue: T,
): T {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (!allowed.includes(value as T)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be one of: ${allowed.join(", ")}`,
    });
  }

  return value as T;
}

/**
 * Like `parseEnum` but returns `undefined` when `value` is absent, so the
 * caller knows not to include it in a partial PATCH payload.
 */
export function parseOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!allowed.includes(value as T)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be one of: ${allowed.join(", ")}`,
    });
  }

  return value as T;
}

/**
 * Parses a required date field. Accepts an ISO date string; throws 400 when
 * missing, non-string, or an invalid date.
 */
export function parseDate(value: unknown, fieldName: string): Date {
  if (value === undefined || value === null) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required`,
    });
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a date string`,
    });
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a valid date string`,
    });
  }

  return date;
}

/**
 * Parses an optional nullable date field.
 * - `undefined` / absent → `undefined` (don't include in PATCH payload)
 * - `null` → `null` (explicitly clear the field)
 * - string → parsed Date, throws 400 on invalid
 */
export function parseOptionalDate(
  value: unknown,
  fieldName: string,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a date string or null when provided`,
    });
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a valid date string`,
    });
  }

  return date;
}

/**
 * Parses an optional nullable integer field (≥ 0).
 * Returns `undefined` when absent, `null` to clear, or the integer value.
 */
export function parseOptionalInt(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a non-negative integer or null when provided`,
    });
  }

  return value;
}

/**
 * Parses an optional nullable float field.
 * Returns `undefined` when absent, `null` to clear, or the number value.
 */
export function parseOptionalFloat(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || isNaN(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a number or null when provided`,
    });
  }

  return value;
}
