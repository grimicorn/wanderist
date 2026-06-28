/**
 * Shared test utilities for trip and stop route handler tests.
 *
 * These helpers reduce repetition across the stops-create, stops-delete,
 * stops-patch, stops-reorder, trip-get, and trip-patch test suites.
 */

/**
 * Creates a 404 error object that matches what `loadOwnedOrThrow` and
 * `loadOwnedTrip` reject with when the resource is not found or not owned by
 * the authenticated user. Use this with `mockRejectedValue` to simulate
 * ownership failures without duplicating the construction in every test file.
 */
export function makeOwnershipError(): Error & { statusCode: number } {
  return Object.assign(new Error("Not found"), { statusCode: 404 });
}

/**
 * Calls a Nitro route handler (unwrapped from defineEventHandler) with the
 * given event object. Casts the return as `Promise<unknown>` for use in
 * `expect(...).rejects.*` assertions.
 */
export function callHandler(handler: unknown, event: object): Promise<unknown> {
  return (handler as (event: object) => Promise<unknown>)(event);
}
