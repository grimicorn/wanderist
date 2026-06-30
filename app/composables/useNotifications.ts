import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";

export interface AppNotification {
  id: string;
  type: string;
  tone: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATIONS_STATE_KEY = "notifications:list";

export function useNotifications() {
  const { apiFetch } = useApiClient();

  const notifications = useState<AppNotification[]>(
    NOTIFICATIONS_STATE_KEY,
    () => [],
  );
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const unreadCount = computed(
    () =>
      notifications.value.filter((notification) => !notification.isRead).length,
  );

  async function fetchNotifications(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await apiFetch<{ notifications: AppNotification[] }>(
        "/api/notifications",
      );
      notifications.value = response.notifications;
    } catch (fetchError: unknown) {
      error.value = extractErrorMessage(fetchError);
    } finally {
      isLoading.value = false;
    }
  }

  async function markAllRead(): Promise<void> {
    error.value = null;
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      notifications.value = notifications.value.map((notification) => ({
        ...notification,
        isRead: true,
      }));
    } catch (markError: unknown) {
      error.value = extractErrorMessage(markError);
    }
  }

  return {
    notifications,
    isLoading: readonly(isLoading),
    error: readonly(error),
    unreadCount,
    fetchNotifications,
    markAllRead,
  };
}
