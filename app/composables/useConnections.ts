/**
 * Composable for managing connected third-party accounts.
 *
 * Wraps the /api/connections/* endpoints and exposes reactive state for
 * Instagram and Google connection status. Follows the same pattern as
 * usePreferences: apiFetch for auth, useState for SSR-safe shared state.
 */

import { useApiClient } from "~/composables/useApiClient";

export interface InstagramConnectionState {
  connected: boolean;
}

export interface GoogleConnectionState {
  connected: boolean;
  emailAddress: string | null;
  identificationId: string | null;
}

export interface ConnectionsState {
  instagram: InstagramConnectionState;
  google: GoogleConnectionState;
}

const CONNECTIONS_DEFAULTS: ConnectionsState = {
  instagram: { connected: false },
  google: { connected: false, emailAddress: null, identificationId: null },
};

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred";

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return UNEXPECTED_ERROR_MESSAGE;
  }
  const errorObj = error as Record<string, unknown>;
  const data =
    errorObj.data && typeof errorObj.data === "object"
      ? (errorObj.data as Record<string, unknown>)
      : null;
  if (typeof data?.statusMessage === "string") {
    return data.statusMessage;
  }
  if (typeof errorObj.statusMessage === "string") {
    return errorObj.statusMessage;
  }
  if (typeof errorObj.message === "string") {
    return errorObj.message;
  }
  return UNEXPECTED_ERROR_MESSAGE;
}

export function useConnections() {
  const { apiFetch } = useApiClient();

  const connections = useState<ConnectionsState>("connections-state", () => ({
    ...CONNECTIONS_DEFAULTS,
    instagram: { ...CONNECTIONS_DEFAULTS.instagram },
    google: { ...CONNECTIONS_DEFAULTS.google },
  }));

  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const actionError = ref<string | null>(null);
  const importResult = ref<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function fetchConnections(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      const [instagram, google] = await Promise.all([
        apiFetch<InstagramConnectionState>("/api/connections/instagram"),
        apiFetch<GoogleConnectionState>("/api/connections/google"),
      ]);
      connections.value.instagram = instagram;
      connections.value.google = google;
    } catch (error: unknown) {
      loadError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  function startInstagramConnect(): void {
    // Navigates the top-level window to the OAuth start endpoint, which sets
    // the state cookie and redirects to Instagram. The callback redirects back
    // to /settings?connection=instagram_success#connections.
    window.location.href = "/api/connections/instagram/start";
  }

  async function disconnectInstagram(): Promise<boolean> {
    actionError.value = null;
    try {
      await apiFetch("/api/connections/instagram", { method: "DELETE" });
      connections.value.instagram = { connected: false };
      return true;
    } catch (error: unknown) {
      actionError.value = extractErrorMessage(error);
      return false;
    }
  }

  async function disconnectGoogle(): Promise<boolean> {
    actionError.value = null;
    const { identificationId } = connections.value.google;
    if (!identificationId) {
      actionError.value = "No Google account connected";
      return false;
    }
    try {
      await apiFetch("/api/connections/google", {
        method: "DELETE",
        body: { identificationId },
      });
      connections.value.google = {
        connected: false,
        emailAddress: null,
        identificationId: null,
      };
      return true;
    } catch (error: unknown) {
      actionError.value = extractErrorMessage(error);
      return false;
    }
  }

  async function importInstagramPhotos(): Promise<boolean> {
    actionError.value = null;
    importResult.value = null;
    try {
      const result = await apiFetch<{
        imported: number;
        skipped: number;
        errors: string[];
      }>("/api/connections/instagram/import", { method: "POST" });
      importResult.value = result;
      return true;
    } catch (error: unknown) {
      actionError.value = extractErrorMessage(error);
      return false;
    }
  }

  return {
    connections: readonly(connections),
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    actionError: readonly(actionError),
    importResult: readonly(importResult),
    fetchConnections,
    startInstagramConnect,
    disconnectInstagram,
    disconnectGoogle,
    importInstagramPhotos,
  };
}
