import { eq } from "drizzle-orm";
import { requireUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { clerkDeleteUser } from "../../utils/clerkAccount";

// Grace period before the row and all FK children are permanently purged.
const DELETE_GRACE_PERIOD_DAYS = 14;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  // Soft-delete: stamp deletedAt so a scheduled job can purge after the grace
  // period. FK cascade (ON DELETE CASCADE) will clean up child rows automatically
  // when the users row is deleted at purge time.
  const gracePeriodEndsAt = addDays(new Date(), DELETE_GRACE_PERIOD_DAYS);

  const updated = await database
    .update(users)
    .set({ deletedAt: gracePeriodEndsAt })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Delete from Clerk so the user cannot sign in again immediately.
  // If this fails the soft-delete is already stamped; a retry will hit the 404
  // branch above (Clerk user gone) but the DB row can still be purged by the
  // scheduled job.
  try {
    await clerkDeleteUser(userId);
  } catch (error: unknown) {
    console.error(
      `account delete: Clerk deleteUser failed for ${userId}`,
      error,
    );
    throw createError({
      statusCode: 502,
      statusMessage:
        "Account marked for deletion but sign-out from Clerk failed. Contact support.",
    });
  }

  return { ok: true, gracePeriodEndsAt: gracePeriodEndsAt.toISOString() };
});
