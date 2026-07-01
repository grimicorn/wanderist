/**
 * Thin alias for @clerk/nuxt's useAuth composable.
 *
 * Provides a stable project-level name used throughout the codebase. Exposing
 * it as a dedicated composable ensures Nuxt auto-imports it alongside the other
 * composables in this directory.
 */
export function useClerkAuth() {
  return useAuth();
}
