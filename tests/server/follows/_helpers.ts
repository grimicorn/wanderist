import { vi } from "vitest";

/**
 * Installs Nitro/H3 global stubs (defineEventHandler, createError,
 * readBody, getRouterParam) before importing server route modules.
 *
 * Call this at the top of each follows-endpoint test file, before any
 * vi.mock() or import() calls that touch the server handlers.
 */
export function installNitroGlobals() {
  vi.stubGlobal(
    "defineEventHandler",
    (handler: (event: unknown) => unknown) => handler,
  );
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) => {
      const error = new Error(options.statusMessage) as Error & {
        statusCode: number;
        statusMessage: string;
      };
      error.statusCode = options.statusCode;
      error.statusMessage = options.statusMessage;
      return error;
    },
  );
  vi.stubGlobal("readBody", vi.fn());
  vi.stubGlobal("getRouterParam", vi.fn());
}

/**
 * Unwraps the default export from a dynamically-imported server route module.
 * Nitro route modules export a function wrapped by defineEventHandler; the
 * stub above returns the inner handler directly, so this helper handles both
 * the "default" property shape and the bare-function shape.
 */
export function unwrapHandler(
  module: Record<string, unknown>,
): (event: unknown) => Promise<unknown> {
  return ("default" in module ? module.default : module) as (
    event: unknown,
  ) => Promise<unknown>;
}

export function makeSelectChain(rows: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

export function makeSelectChainNoLimit(rows: Record<string, unknown>[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

export function makeInsertChain(
  returningRows: Record<string, unknown>[] = [{ followerId: "follower-1" }],
) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert };
}

export function makeDeleteChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where });
  return { delete: deleteFn };
}
