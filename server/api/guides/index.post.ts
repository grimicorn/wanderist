import { ensureUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { guides, VISIBILITY } from "../../db/schema";
import { requireString, optionalString } from "../../utils/db-helpers";
import { parseEnum, parseOptionalInt } from "../../utils/validation";

const VALID_VISIBILITIES = [VISIBILITY.PRIVATE, VISIBILITY.PUBLIC] as const;

// A guide with a 0-minute read time isn't meaningful; the schema's default of
// 5 already implies "at least 1", this just enforces it on explicit input.
const MIN_READ_TIME_MINUTES = 1;

function generateId(): string {
  return crypto.randomUUID();
}

function parseReadTimeMinutes(value: unknown): number | undefined {
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

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const body = await readBody(event);

  requireString(body?.title, "title");
  const title = (body.title as string).trim();

  if (title === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "title must not be empty",
    });
  }

  const guideBody = optionalString(body?.body, "body");
  const readTimeMinutes = parseReadTimeMinutes(body?.readTimeMinutes);
  const visibility = parseEnum(
    body?.visibility,
    VALID_VISIBILITIES,
    "visibility",
    VISIBILITY.PRIVATE,
  );

  const database = getDb();

  // likeCount is intentionally omitted so the column default (0) applies —
  // authoring a guide must never let a caller seed or corrupt the
  // denormalised like count used for explore-page ranking.
  const inserted = await database
    .insert(guides)
    .values({
      id: generateId(),
      userId,
      title,
      body: guideBody ?? null,
      ...(readTimeMinutes !== undefined ? { readTimeMinutes } : {}),
      visibility,
    })
    .returning();

  return inserted[0];
});
