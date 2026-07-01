import { vi } from "vitest";

/**
 * Installs Nitro/H3 global stubs (defineEventHandler, createError)
 * before importing server route modules.
 *
 * Call this at the top of each notifications-endpoint test file, before any
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
}

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

export function makeSelectChain(rows: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

export function makeInsertChain() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return { insert };
}

export function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update };
}
