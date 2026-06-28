/**
 * Composable for account-management actions: password change, avatar, and
 * account deletion.
 *
 * All API calls go through `apiFetch` so the Clerk session token is injected
 * automatically.
 */
import { useApiClient } from "~/composables/useApiClient";

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred";

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return UNEXPECTED_ERROR_MESSAGE;
  }
  const errorObj = error as Record<string, unknown>;
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

export function useAccountActions() {
  const { apiFetch } = useApiClient();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function changePassword(password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await apiFetch("/api/account/password", {
        method: "PATCH",
        body: { password },
      });
      return true;
    } catch (fetchError: unknown) {
      error.value = extractErrorMessage(fetchError);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await apiFetch<{ imageUrl: string | null }>(
        "/api/account/avatar",
        {
          method: "PATCH",
          headers: { "Content-Type": file.type },
          body: await file.arrayBuffer(),
        },
      );
      return result.imageUrl;
    } catch (fetchError: unknown) {
      error.value = extractErrorMessage(fetchError);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function removeAvatar(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await apiFetch("/api/account/avatar?action=remove", { method: "PATCH" });
      return true;
    } catch (fetchError: unknown) {
      error.value = extractErrorMessage(fetchError);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteAccount(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      return true;
    } catch (fetchError: unknown) {
      error.value = extractErrorMessage(fetchError);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    changePassword,
    uploadAvatar,
    removeAvatar,
    deleteAccount,
  };
}
