import type { H3Event } from "h3";

export function requireUser(event: H3Event): { userId: string } {
  const auth = event.context.auth as { userId: string } | undefined;

  if (!auth?.userId) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  return auth;
}
