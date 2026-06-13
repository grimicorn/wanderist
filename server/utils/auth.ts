import type { H3Event } from "h3";

export function requireUser(event: H3Event): string {
  const userId = event.context.userId;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return userId;
}
