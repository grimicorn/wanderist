import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { guides, VISIBILITY_VALUES } from "../../db/schema";
import {
  assertOwnership,
  optionalString,
  requireRouterParam,
} from "../../utils/db-helpers";
import { requireUser } from "../../utils/auth";
import { parseOptionalEnum, setIfDefined } from "../../utils/validation";
import {
  parseOptionalGuideBody,
  parseReadTimeMinutes,
} from "../../utils/guide-helpers";

type GuidePatchFields = Partial<typeof guides.$inferInsert>;

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

function buildPatchFields(body: Record<string, unknown>): GuidePatchFields {
  const fields: GuidePatchFields = {};

  setIfDefined(fields, "title", parseTitle(body));
  setIfDefined(fields, "body", parseOptionalGuideBody(body.body));
  setIfDefined(
    fields,
    "readTimeMinutes",
    parseReadTimeMinutes(body.readTimeMinutes),
  );
  setIfDefined(
    fields,
    "visibility",
    parseOptionalEnum(body.visibility, VISIBILITY_VALUES, "visibility"),
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

  // assertOwnership already resolves and validates the authenticated user;
  // requireUser here is a second, cheap read of event.context (no extra
  // query) so the update below can be scoped to the owner directly rather
  // than relying solely on the preceding check.
  await assertOwnership(event, guides, guides.id, guides.userId, id);
  const userId = requireUser(event);

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
    .where(and(eq(guides.id, id), eq(guides.userId, userId)))
    .returning();

  if (!updated[0]) {
    // The row existed at the ownership check above but is gone by the time
    // of the write (e.g. deleted from another tab in between) — 404 rather
    // than silently returning an empty body the store would splice into its
    // guide list as `undefined`.
    throw createError({ statusCode: 404, statusMessage: "Guide not found" });
  }

  return updated[0];
});
