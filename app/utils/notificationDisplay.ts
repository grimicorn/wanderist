import type {
  AppNotification,
  AppNotificationActor,
} from "~/composables/useNotifications";

const NEW_FOLLOWER_TYPE = "new_follower";

const ICON_BY_TYPE: Record<string, string> = {
  [NEW_FOLLOWER_TYPE]: "users",
  like: "heart",
  comment: "message",
  import_ready: "instagram",
  trial_ending: "alert-triangle",
};

const DEFAULT_ICON = "bell";
const FALLBACK_ACTOR_LABEL = "Someone";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export function resolveNotificationIcon(type: string): string {
  return ICON_BY_TYPE[type] ?? DEFAULT_ICON;
}

export function formatNotificationTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();

  if (Number.isNaN(diffMs)) {
    return "";
  }

  if (diffMs < MS_PER_HOUR) {
    const minutes = Math.max(1, Math.floor(diffMs / MS_PER_MINUTE));
    return `${minutes}m`;
  }

  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return `${hours}h`;
  }

  if (diffMs < MS_PER_DAY * 2) {
    return "Yesterday";
  }

  if (diffMs < MS_PER_WEEK) {
    return `${Math.floor(diffMs / MS_PER_DAY)}d`;
  }

  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  return `${weeks}w`;
}

/**
 * Renders a label identifying the acting user for a notification, preferring
 * their display name, then their handle, then a generic fallback when neither
 * is set (e.g. a bare account with no profile filled in yet).
 */
export function resolveNotificationActorLabel(
  actor: AppNotificationActor | null,
): string {
  if (!actor) {
    return FALLBACK_ACTOR_LABEL;
  }
  if (actor.displayName) {
    return actor.displayName;
  }
  if (actor.handle) {
    return `@${actor.handle}`;
  }
  return FALLBACK_ACTOR_LABEL;
}

/**
 * Resolves the text to display for a notification. new_follower notifications
 * with a resolved actor are rendered dynamically from the actor's current
 * name/handle (so a later display-name change doesn't leave a stale
 * notification) rather than the string stored at write time. Every other
 * case — other notification types, legacy rows with no actor, or rows whose
 * actor has since deleted their account — falls back to the stored body.
 */
export function resolveNotificationText(notification: AppNotification): string {
  if (notification.type !== NEW_FOLLOWER_TYPE || !notification.actor) {
    return notification.body;
  }
  return `${resolveNotificationActorLabel(notification.actor)} started following you`;
}
