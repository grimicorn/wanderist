import type { H3Event } from "h3";
import { eq, and } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { requireUser } from "./auth";
import { getDb } from "../db/index";

/**
 * Loads a single row from `table` where `idColumn = id` AND `userIdColumn =
 * the authenticated userId`. Throws 401 if not authenticated, 404 if the row
 * is not found (including rows that belong to a different user so we don't
 * leak existence).
 */
export async function loadOwnedOrThrow<T extends Record<string, unknown>>(
  event: H3Event,
  table: PgTable,
  idColumn: PgColumn,
  userIdColumn: PgColumn,
  id: string,
): Promise<T> {
  const userId = requireUser(event);
  const database = getDb();

  const rows = await database
    .select()
    .from(table)
    .where(and(eq(idColumn, id), eq(userIdColumn, userId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  return row as T;
}

/**
 * Asserts that a row belongs to the authenticated user without returning the
 * full row. Throws 401 if not authenticated, 404 if not found or not owned.
 * Useful before delete operations where you don't need the row data.
 */
export async function assertOwnership(
  event: H3Event,
  table: PgTable,
  idColumn: PgColumn,
  userIdColumn: PgColumn,
  id: string,
): Promise<void> {
  await loadOwnedOrThrow(event, table, idColumn, userIdColumn, id);
}

/**
 * Validates that `value` is a non-empty string. Throws 400 with the given
 * field name in the message if the check fails. Use this for required string
 * fields from request bodies before hitting the database.
 */
export function requireString(
  value: unknown,
  fieldName: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required and must be a non-empty string`,
    });
  }
}

/**
 * Validates that `value`, if present, is a string. Returns the value cast to
 * `string | undefined`. Throws 400 if the value is present but not a string.
 */
export function optionalString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a string when provided`,
    });
  }

  return value;
}
