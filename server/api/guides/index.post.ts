import { ensureUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { guides, VISIBILITY } from "../../db/schema";
import { requireString } from "../../utils/db-helpers";
import { parseEnum } from "../../utils/validation";
import {
  parseOptionalGuideBody,
  parseReadTimeMinutes,
} from "../../utils/guide-helpers";

const VALID_VISIBILITIES = [VISIBILITY.PRIVATE, VISIBILITY.PUBLIC] as const;

function generateId(): string {
  return crypto.randomUUID();
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

  const guideBody = parseOptionalGuideBody(body?.body);
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
