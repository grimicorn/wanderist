/**
 * Returns a thin $fetch wrapper that injects the Clerk session token as an
 * Authorization: Bearer header on every /api/* request.
 *
 * Usage:
 *   const { apiFetch } = useApiClient();
 *   const data = await apiFetch('/api/health');
 *
 * The token is resolved fresh per call so it auto-refreshes when the session
 * rotates. `getToken` is a ref containing the Clerk getToken function.
 */
export function useApiClient() {
  const { getToken } = useClerkAuth();

  async function resolveToken(): Promise<string | null> {
    if (!getToken.value) {
      return null;
    }
    return getToken.value();
  }

  async function apiFetch<T>(
    url: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    const token = await resolveToken();

    const existingHeaders = (options.headers ?? {}) as Record<string, string>;
    const headers: Record<string, string> = { ...existingHeaders };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return $fetch<T>(url, { ...options, headers });
  }

  return { apiFetch };
}
