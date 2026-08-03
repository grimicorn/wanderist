/**
 * Shared helpers for guide route handlers.
 *
 * Centralises the readTimeMinutes floor check and body normalisation so
 * POST /api/guides and PATCH /api/guides/:id can't drift out of sync on what
 * counts as a valid read time or how an empty body is stored, plus the
 * read-visibility loader (loadReadableGuide) that GET /api/guides/:id uses to
 * decide who may read a guide.
 */
import { and, eq, isNull } from "drizzle-orm";
import { optionalString } from "./db-helpers";
import { parseOptionalInt } from "./validation";
import type { getDb } from "../db/index";
import { guides, users, userPreferences, VISIBILITY } from "../db/schema";

type Database = ReturnType<typeof getDb>;
type Guide = typeof guides.$inferSelect;

// One message for both 404 branches (missing guide / not allowed to read it) so
// a non-owner can't tell a private or hidden guide apart from one that doesn't
// exist, and the two throws can't drift.
const GUIDE_NOT_FOUND = "Guide not found";

async function fetchGuideRow(
  database: Database,
  id: string,
): Promise<Guide | undefined> {
  const rows = await database
    .select()
    .from(guides)
    .where(eq(guides.id, id))
    .limit(1);

  return rows[0];
}

/**
 * True when a guide is readable by someone who is NOT its owner. Explore is the
 * only place a non-owner obtains a guide id, so a direct read is allowed only
 * for a guide that would surface on explore — the same predicate as
 * discover-queries.fetchGuides: public visibility, the author's account live
 * (not soft-deleted), profile public, and explore enabled. This keeps a guide
 * from staying readable by id after its author deletes their account, goes
 * private, or opts out of explore.
 */
async function isReadableByNonOwner(
  database: Database,
  guide: Guide,
): Promise<boolean> {
  if (guide.visibility !== VISIBILITY.PUBLIC) {
    return false;
  }

  const rows = await database
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userPreferences, eq(users.id, userPreferences.userId))
    .where(
      and(
        eq(users.id, guide.userId),
        isNull(users.deletedAt),
        eq(userPreferences.publicProfile, true),
        eq(userPreferences.showOnExplore, true),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Loads a single guide by id and enforces read visibility: the owner reads
 * their guide at any visibility; a non-owner reads it only when it would show
 * on explore (see isReadableByNonOwner). Anything else throws 404 (not 403) so
 * the endpoint never leaks that a guide with that id exists — mirroring how
 * loadOwnedOrThrow hides other users' rows behind a 404.
 *
 * Takes a pre-built database instance (rather than calling getDb itself) so the
 * visibility rule can be unit-tested in isolation without mocking the db
 * singleton, matching the discover-queries utilities.
 */
export async function loadReadableGuide(
  database: Database,
  id: string,
  userId: string,
): Promise<Guide> {
  const guide = await fetchGuideRow(database, id);

  if (!guide) {
    throw createError({ statusCode: 404, statusMessage: GUIDE_NOT_FOUND });
  }

  if (guide.userId === userId) {
    return guide;
  }

  const readable = await isReadableByNonOwner(database, guide);

  if (!readable) {
    throw createError({ statusCode: 404, statusMessage: GUIDE_NOT_FOUND });
  }

  return guide;
}

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
