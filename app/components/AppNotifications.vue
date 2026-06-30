<template>
  <div
    v-if="open"
    class="notif is-open"
    role="dialog"
    aria-label="Notifications"
  >
    <div class="notif__head">
      <b>Notifications</b>
      <button class="notif__mark" @click="handleMarkAllRead">
        mark all read
      </button>
    </div>
    <div class="notif__list">
      <div v-if="isLoading && notifications.length === 0" class="notif__empty">
        Loading…
      </div>
      <div
        v-else-if="error"
        class="notif__empty notif__empty--error"
        role="alert"
      >
        {{ error }}
      </div>
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notif__item"
        :class="{ 'is-unread': !notification.isRead }"
      >
        <span
          class="notif__ico"
          :class="`notif__ico--${notification.tone ?? 'info'}`"
        >
          <AppIcon :name="resolveIcon(notification.type)" :size="16" />
        </span>
        <div class="notif__body">
          <p class="notif__title">{{ notification.body }}</p>
          <span class="notif__time">{{
            formatRelativeTime(notification.createdAt)
          }}</span>
        </div>
        <span class="notif__dot" />
      </div>
    </div>
    <NuxtLink class="notif__foot" to="/activity">
      View all activity
      <AppIcon name="arrow-right" :size="14" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
// No imports — all composables and Vue APIs are Nuxt auto-imports, accessed
// as globals so tests can substitute them via vi.stubGlobal.

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

function resolveIcon(type: string): string {
  return ICON_BY_TYPE[type] ?? DEFAULT_ICON;
}

function formatRelativeTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();

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

const props = defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();

const { notifications, isLoading, error, fetchNotifications, markAllRead } =
  useNotifications();

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      fetchNotifications().catch((fetchError: unknown) => {
        console.error(
          "[AppNotifications] fetchNotifications failed",
          fetchError,
        );
      });
    }
  },
);

async function handleMarkAllRead(): Promise<void> {
  await markAllRead();
}
</script>
