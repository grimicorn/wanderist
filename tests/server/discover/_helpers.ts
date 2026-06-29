import type { getDb } from "../../../server/db/index";

/**
 * Unwraps the default export from a dynamically-imported server route module.
 */
export function unwrapHandler(
  module: Record<string, unknown>,
): (event: unknown) => Promise<unknown> {
  return ("default" in module ? module.default : module) as (
    event: unknown,
  ) => Promise<unknown>;
}

/**
 * Builds a stub database value that satisfies the ReturnType<typeof getDb>
 * type constraint. Handler tests that don't need to assert on DB calls can use
 * this to satisfy the mockGetDb.mockReturnValue() call.
 */
export function makeStubDatabase() {
  return {} as ReturnType<typeof getDb>;
}
