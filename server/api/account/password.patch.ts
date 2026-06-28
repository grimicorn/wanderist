import { requireUser } from "../../utils/auth";
import { clerkUpdatePassword } from "../../utils/clerkAccount";
import { requireString } from "../../utils/db-helpers";

const MIN_PASSWORD_LENGTH = 8;

function assertPasswordValid(password: unknown): asserts password is string {
  requireString(password, "password");
  if ((password as string).length < MIN_PASSWORD_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body must be a JSON object",
    });
  }

  assertPasswordValid(body.password);

  try {
    await clerkUpdatePassword(userId, body.password);
  } catch (error: unknown) {
    const statusCode = clerkErrorStatusCode(error);
    const message = extractClerkErrorMessage(error);
    throw createError({
      statusCode,
      statusMessage: message ?? "Failed to update password",
    });
  }

  return { ok: true };
});

function clerkErrorStatusCode(error: unknown): number {
  if (!error || typeof error !== "object") {
    return 502;
  }
  const errorObj = error as Record<string, unknown>;
  // Clerk SDK errors expose `.status`; some wrappers surface `.statusCode`.
  // 422 signals a user-fixable validation error; anything else is a server issue.
  const httpStatus = errorObj.status ?? errorObj.statusCode;
  if (typeof httpStatus === "number" && httpStatus === 422) {
    return 422;
  }
  return 502;
}

function extractClerkErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const errorObj = error as Record<string, unknown>;

  // Clerk SDK errors expose an `errors` array with structured messages.
  // `longMessage` is user-actionable; fall back to `message` if absent.
  const errors = errorObj.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as Record<string, unknown>;
    if (typeof first.longMessage === "string") {
      return first.longMessage;
    }
    if (typeof first.message === "string") {
      return first.message;
    }
  }

  if (typeof errorObj.message === "string") {
    return errorObj.message;
  }

  return null;
}
