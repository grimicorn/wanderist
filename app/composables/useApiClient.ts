/**
 * Returns a thin $fetch wrapper that injects the Clerk session token as an
 * Authorization: Bearer header on /api/* requests.
 *
 * Usage:
 *   const { apiFetch } = useApiClient();
 *   const data = await apiFetch('/api/health');
 *
 * The token is only injected for same-origin (relative) URLs. Absolute URLs
 * to external hosts do not receive the Clerk JWT so the session token cannot
 * be leaked to third parties.
 *
 * The token is resolved fresh per call so it auto-refreshes when the session
 * rotates. `getToken` is a ref containing the Clerk getToken function.
 */
export function useApiClient() {
  const { getToken } = useClerkAuth();

  function isInternalUrl(url: string): boolean {
    return url.startsWith("/");
  }

  async function resolveToken(): Promise<string | null> {
    if (!getToken.value) {
      return null;
    }
    return getToken.value();
  }

  function buildHeaders(
    existingHeaders: HeadersInit | undefined,
    token: string | null,
  ): Headers {
    // Normalize via the Headers constructor, which handles record, Headers
    // instance, and string[][] shapes without losing any caller-supplied headers.
    const headers = new Headers(existingHeaders);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  async function apiFetch<T>(
    url: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    const token = isInternalUrl(url) ? await resolveToken() : null;
    const headers = buildHeaders(
      options.headers as HeadersInit | undefined,
      token,
    );
    return $fetch<T>(url, { ...options, headers });
  }

  return { apiFetch };
}
