/**
 * Shared test utilities for the account API handler test suites.
 */
import { expect } from "vitest";

/**
 * Stubs the Nitro `createError` auto-import so server handlers can be
 * imported and exercised outside the Nuxt runtime.
 *
 * Call before importing any handler module under test.
 */
export function stubCreateError(): void {
  Object.assign(globalThis, {
    createError: (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  });
}

/**
 * Stubs `defineEventHandler` so handler modules export the raw async
 * function rather than a Nitro-wrapped version.
 */
export function stubDefineEventHandler(): void {
  Object.assign(globalThis, {
    defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  });
}

/**
 * Builds a minimal H3Event-like object for account API tests.
 */
export function buildAccountEvent(userId = "user-1"): object {
  return { context: { userId } };
}

/**
 * Calls a handler function with the given event and returns the result.
 */
export function callHandler(handler: unknown, event: object): Promise<unknown> {
  return (handler as (event: object) => Promise<unknown>)(event);
}

/**
 * Configures a `requireUser` mock to throw a 401 on the next call, then
 * asserts that calling the handler rejects with that status code.
 *
 * All three account handler test suites share this assertion, so it lives here
 * rather than being duplicated in each file.
 */
export async function assertThrows401WhenNotAuthenticated(
  requireUserMock: ReturnType<typeof import("vitest").vi.fn>,
  handler: unknown,
): Promise<void> {
  requireUserMock.mockImplementation(() => {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  });

  await expect(callHandler(handler, buildAccountEvent())).rejects.toMatchObject(
    { statusCode: 401 },
  );
}
