const ICON_BY_TYPE: Record<string, string> = {
  new_follower: "users",
  like: "heart",
  comment: "message",
  import_ready: "instagram",
  trial_ending: "alert-triangle",
};

const DEFAULT_ICON = "bell";

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

  if (diffMs < MS_PER_WEEK) {
    const days = Math.floor(diffMs / MS_PER_DAY);
    if (days === 1) {
      return "Yesterday";
    }
    return `${days}d`;
  }

  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  return `${weeks}w`;
}
