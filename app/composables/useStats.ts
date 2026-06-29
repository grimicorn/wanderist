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

  /**
   * Returns the total distance in the user's preferred unit
   * (miles or km based on their distanceUnit preference).
   */
  const displayDistance = computed(() =>
    stats.value.distanceUnit === "km"
      ? stats.value.totalDistanceKm
      : stats.value.totalDistanceMi,
  );

  /**
   * Returns the week-over-week distance delta in the user's preferred unit.
   */
  const displayDistanceDelta = computed(() =>
    stats.value.distanceUnit === "km"
      ? stats.value.distanceKmThisWeek
      : stats.value.distanceMiThisWeek,
  );

  /**
   * Returns the label for the distance unit ("Km logged" or "Miles logged").
   */
  const displayDistanceLabel = computed(() =>
    stats.value.distanceUnit === "km" ? "Km logged" : "Miles logged",
  );

  async function fetchStats(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      const data = await apiFetch<UserStats>("/api/stats");
      stats.value = data;
    } catch (error: unknown) {
      stats.value = { ...STATS_DEFAULTS };
      loadError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    stats,
    displayDistance,
    displayDistanceDelta,
    displayDistanceLabel,
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    fetchStats,
  };
}
