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

  // Delete from Clerk first so the operation is easier to make all-or-nothing:
  // if Clerk fails, nothing is mutated in our DB. If Clerk succeeds but the DB
  // update fails, the Clerk user is gone and cannot sign in — the row will be
  // cleaned up by the purge job (which tolerates rows with no matching Clerk user).
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
        "Failed to delete account from auth provider. Please try again or contact support.",
    });
  }

  // Soft-delete: stamp deletedAt with the current time so a scheduled job can
  // find rows where `deletedAt + DELETE_GRACE_PERIOD_DAYS < now` and purge them.
  // FK CASCADE (ON DELETE CASCADE) handles child rows at purge time.
  const updated = await database
    .update(users)
    .set({ deletedAt: now })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated[0]) {
    // Clerk user was deleted but the DB row was not found. Log it for ops triage
    // but return success — the user cannot sign in and the account is effectively gone.
    console.error(
      `account delete: DB user not found after Clerk deletion for ${userId}`,
    );
  }

  return { ok: true, gracePeriodEndsAt: purgeAfter.toISOString() };
});
