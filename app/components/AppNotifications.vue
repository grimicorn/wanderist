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
          <AppIcon
            :name="resolveNotificationIcon(notification.type)"
            :size="16"
          />
        </span>
        <div class="notif__body">
          <p class="notif__title">{{ notification.body }}</p>
          <span class="notif__time">{{
            formatNotificationTime(notification.createdAt)
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
// Vue APIs are Nuxt auto-imports (accessed as globals so tests can substitute
// them via vi.stubGlobal). Utility functions are imported explicitly.
import {
  resolveNotificationIcon,
  formatNotificationTime,
} from "~/utils/notificationDisplay";

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
