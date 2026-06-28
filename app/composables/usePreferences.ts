import { useApiClient } from "~/composables/useApiClient";
import type { DISTANCE_UNIT } from "../../server/db/schema";

export interface UserPreferences {
  distanceUnit: (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];
  defaultMapStyle: string | null;
  publicProfile: boolean;
  preciseLocation: boolean;
  showOnExplore: boolean;
  displayName: string | null;
  handle: string | null;
  homeBase: string | null;
  bio: string | null;
}

export const PREFERENCES_DEFAULTS: UserPreferences = {
  distanceUnit: "mi",
  defaultMapStyle: null,
  publicProfile: false,
  preciseLocation: false,
  showOnExplore: true,
  displayName: null,
  handle: null,
  homeBase: null,
  bio: null,
};

export function usePreferences() {
  const { apiFetch } = useApiClient();

  const preferences = useState<UserPreferences>("user-preferences", () => ({
    ...PREFERENCES_DEFAULTS,
  }));

  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const saveError = ref<string | null>(null);

  async function fetchPreferences(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      const data = await apiFetch<UserPreferences>("/api/preferences");
      preferences.value = data;
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      loadError.value = message;
    } finally {
      isLoading.value = false;
    }
  }

  async function savePreferences(
    patch: Partial<UserPreferences>,
  ): Promise<boolean> {
    saveError.value = null;

    try {
      const data = await apiFetch<UserPreferences>("/api/preferences", {
        method: "PATCH",
        body: patch,
      });
      preferences.value = data;
      return true;
    } catch (error: unknown) {
      saveError.value = extractErrorMessage(error);
      return false;
    }
  }

  return {
    preferences,
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    saveError: readonly(saveError),
    fetchPreferences,
    savePreferences,
  };
}

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred";

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return UNEXPECTED_ERROR_MESSAGE;
  }
  const errorObj = error as Record<string, unknown>;

  // ofetch wraps server errors: the Nitro statusMessage lands in error.data
  const data = errorObj.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj.statusMessage === "string") {
      return dataObj.statusMessage;
    }
  }

  if (typeof errorObj.statusMessage === "string") {
    return errorObj.statusMessage;
  }
  if (typeof errorObj.message === "string") {
    return errorObj.message;
  }
  return UNEXPECTED_ERROR_MESSAGE;
}
