import type { H3Event } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { users } from "../db/schema";
import { getClerkClient } from "./clerk";

export function requireUser(event: H3Event): string {
  const userId = event.context.userId;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return userId;
}

/**
 * Ensures a users row exists for the current request's Clerk user.
 * Call this at the top of any API handler that inserts rows referencing users.id,
 * so the first request after signup never fails before the webhook lands.
 */
export async function ensureUser(event: H3Event): Promise<string> {
  const userId = requireUser(event);

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length > 0) {
    return userId;
  }

  const clerkClient = getClerkClient();
  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  );

  if (!primaryEmail) {
    throw createError({
      statusCode: 422,
      statusMessage: "Clerk user has no primary email address",
    });
  }

  await db
    .insert(users)
    .values({ id: userId, email: primaryEmail.emailAddress })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: primaryEmail.emailAddress },
    });

  return userId;
}
