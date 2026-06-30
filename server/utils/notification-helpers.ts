import { getDb } from "../db/index";
import { notifications } from "../db/schema";

export interface NotificationInput {
  userId: string;
  type: string;
  tone: string | null;
  body: string;
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
    });
  } catch (error) {
    console.error(
      "[notification-helpers] createNotification failed",
      input,
      error,
    );
  }
}
