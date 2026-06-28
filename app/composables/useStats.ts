import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";
import type { UserStats } from "../../server/utils/stats-queries";

export type { UserStats };

const STATS_STATE_KEY = "user-stats";

const STATS_DEFAULTS: UserStats = {
  placesCount: 0,
  countriesCount: 0,
  totalDistanceMi: 0,
  totalDistanceKm: 0,
  currentStreak: 0,
  placesThisWeek: 0,
  distanceMiThisWeek: 0,
  distanceKmThisWeek: 0,
  distanceUnit: "mi",
};

export function useStats() {
  const { apiFetch } = useApiClient();

  const stats = useState<UserStats>(STATS_STATE_KEY, () => ({
    ...STATS_DEFAULTS,
  }));

  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  async function fetchStats(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      const data = await apiFetch<UserStats>("/api/stats");
      stats.value = data;
    } catch (error: unknown) {
      loadError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    stats,
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    fetchStats,
  };
}
