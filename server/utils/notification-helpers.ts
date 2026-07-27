import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { notifications, users, userPreferences } from "../db/schema";

export interface NotificationInput {
  userId: string;
  type: string;
  tone: string | null;
  body: string;
  // The user whose action triggered this notification (e.g. the follower for
  // a new_follower notification). Omit or pass null when there is no acting
  // user to attribute (or the actor should stay anonymous).
  actorId?: string | null;
}

/**
 * Inserts a notification row for the given user.
 *
 * Errors are swallowed and logged — a notification failure must never
 * surface to the caller or break the action that triggered it.
 */
export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  try {
    const database = getDb();
    await database.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      tone: input.tone,
      body: input.body,
      actorId: input.actorId ?? null,
    });
  } catch (error) {
    console.error(
      "[notification-helpers] createNotification failed",
      input,
      error,
    );
  }
}

export interface NotificationActor {
  id: string;
  displayName: string | null;
  handle: string | null;
}

export interface NotificationRow {
  id: string;
  type: string;
  tone: string | null;
  body: string;
  isRead: boolean;
  createdAt: Date;
  actor: NotificationActor | null;
}

type Database = ReturnType<typeof getDb>;

interface RawNotificationRow {
  id: string;
  type: string;
  tone: string | null;
  body: string;
  isRead: boolean;
  createdAt: Date;
  actorId: string | null;
  actorDisplayName: string | null;
  actorHandle: string | null;
  actorDeletedAt: Date | null;
}

/**
 * Resolves the acting-user reference on a notification row into a renderable
 * actor, or null when there is nothing to show. Null covers legacy rows
 * (actorId was never set), rows whose actor has since soft-deleted their
 * account, and rows whose actor has a private (non-public) profile — all
 * three fall back to the notification's own generic body text. Private
 * profiles resolve to null rather than an id-only actor: there being nothing
 * to display should mean nothing identifying is returned either, so a private
 * user's id can't later be wired into a profile link and defeat the privacy
 * gate on the userPreferences join above.
 */
function resolveActor(row: RawNotificationRow): NotificationActor | null {
  if (!row.actorId || row.actorDeletedAt) {
    return null;
  }
  if (!row.actorDisplayName && !row.actorHandle) {
    return null;
  }
  return {
    id: row.actorId,
    displayName: row.actorDisplayName,
    handle: row.actorHandle,
  };
}

/**
 * Returns the most recent notifications for a user, with the acting user (if
 * any) resolved via a left join so legacy and deleted-actor rows still return
 * cleanly rather than being dropped or throwing.
 */
export async function fetchNotificationsForUser(
  database: Database,
  userId: string,
  limit: number,
): Promise<NotificationRow[]> {
  const rows = await database
    .select({
      id: notifications.id,
      type: notifications.type,
      tone: notifications.tone,
      body: notifications.body,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      actorId: notifications.actorId,
      actorDisplayName: userPreferences.displayName,
      actorHandle: userPreferences.handle,
      actorDeletedAt: users.deletedAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    // Gated on publicProfile, matching every other cross-user disclosure of
    // displayName/handle in this codebase (discover-queries.ts,
    // search-queries.ts) — publicProfile defaults to false and is plan-gated,
    // so a private actor must not have their name/handle leaked here even
    // though the recipient can see *that* someone followed them. A private
    // actor's row still joins on `users` above (for the deletedAt check) but
    // resolves to no displayName/handle, which resolveActor below treats the
    // same as no actor at all (falls back to the generic body client-side).
    .leftJoin(
      userPreferences,
      and(
        eq(notifications.actorId, userPreferences.userId),
        eq(userPreferences.publicProfile, true),
      ),
    )
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    tone: row.tone,
    body: row.body,
    isRead: row.isRead,
    createdAt: row.createdAt,
    actor: resolveActor(row),
  }));
}
