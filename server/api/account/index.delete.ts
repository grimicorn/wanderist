import { eq } from "drizzle-orm";
import { requireUser } from "../../utils/auth";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { clerkDeleteUser } from "../../utils/clerkAccount";

// Grace period before the row and all FK children are permanently purged.
const DELETE_GRACE_PERIOD_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function gracePeriodEndsAt(now: Date): Date {
  return new Date(now.getTime() + DELETE_GRACE_PERIOD_DAYS * MS_PER_DAY);
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  const now = new Date();
  const purgeAfter = gracePeriodEndsAt(now);

  // Soft-delete: stamp deletedAt with the current time so a scheduled job can
  // find rows where `deletedAt + DELETE_GRACE_PERIOD_DAYS < now` and purge them.
  // FK CASCADE (ON DELETE CASCADE) handles child rows at purge time.
  const updated = await database
    .update(users)
    .set({ deletedAt: now })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Delete from Clerk so the user cannot sign in during the grace period.
  // If this fails, deletedAt is already stamped; the row will still be purged
  // by the scheduled job after the grace period ends. The user should contact
  // support to retry the Clerk removal.
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

  return { ok: true, gracePeriodEndsAt: purgeAfter.toISOString() };
});
