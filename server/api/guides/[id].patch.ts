import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { guides, VISIBILITY } from "../../db/schema";
import {
  assertOwnership,
  optionalString,
  requireRouterParam,
} from "../../utils/db-helpers";
import {
  parseOptionalEnum,
  parseOptionalInt,
  setIfDefined,
} from "../../utils/validation";

type GuidePatchFields = Partial<typeof guides.$inferInsert>;

const VALID_VISIBILITIES = [VISIBILITY.PRIVATE, VISIBILITY.PUBLIC] as const;
const MIN_READ_TIME_MINUTES = 1;

function parseTitle(body: Record<string, unknown>): string | undefined {
  const title = optionalString(body.title, "title");

  if (title === undefined) {
    return undefined;
  }

  const trimmed = title.trim();

  if (trimmed === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "title must be a non-empty string when provided",
    });
  }

  return trimmed;
}

function parseReadTimeMinutes(
  body: Record<string, unknown>,
): number | undefined {
  const readTimeMinutes = parseOptionalInt(
    body.readTimeMinutes,
    "readTimeMinutes",
  );

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

function buildPatchFields(body: Record<string, unknown>): GuidePatchFields {
  const fields: GuidePatchFields = {};

  setIfDefined(fields, "title", parseTitle(body));
  setIfDefined(fields, "body", optionalString(body.body, "body"));
  setIfDefined(fields, "readTimeMinutes", parseReadTimeMinutes(body));
  setIfDefined(
    fields,
    "visibility",
    parseOptionalEnum(body.visibility, VALID_VISIBILITIES, "visibility"),
  );

  return fields;
}

function requireNonEmptyPatch(fields: GuidePatchFields): void {
  if (Object.keys(fields).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields provided to update",
    });
  }
}

export default defineEventHandler(async (event) => {
  const id = requireRouterParam(event, "id");

  await assertOwnership(event, guides, guides.id, guides.userId, id);

  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;

  // likeCount is deliberately not accepted here — the only whitelisted
  // fields are title/body/readTimeMinutes/visibility, so the denormalised
  // like count used for explore-page ranking can never be overwritten
  // through the authoring path.
  const patchFields = buildPatchFields(body);

  requireNonEmptyPatch(patchFields);

  const database = getDb();

  const updated = await database
    .update(guides)
    .set(patchFields)
    .where(eq(guides.id, id))
    .returning();

  return updated[0];
});
