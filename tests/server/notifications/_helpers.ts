import { vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

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

/**
 * Builds a mock `select().from().leftJoin().leftJoin().where().orderBy().limit()`
 * chain, matching fetchNotificationsForUser's actor-resolution join.
 *
 * Exposes the two `leftJoin` spies (rather than just `select`) so a test can
 * assert on the actual join target/condition, not just the canned rows — a
 * mock returning fixed rows regardless of the join key would otherwise pass
 * even if the query joined on the wrong column (e.g. the recipient's own id
 * instead of the actor's).
 */
export function makeSelectChain(rows: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const secondLeftJoin = vi.fn().mockReturnValue({ where });
  const firstLeftJoin = vi.fn().mockReturnValue({ leftJoin: secondLeftJoin });
  const from = vi.fn().mockReturnValue({ leftJoin: firstLeftJoin });
  const select = vi.fn().mockReturnValue({ from });
  return { select, firstLeftJoin, secondLeftJoin };
}

function isColumnChunk(value: unknown): value is PgColumn {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "table" in value
  );
}

function isSqlChunk(value: unknown): value is SQL {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as SQL).queryChunks)
  );
}

function collectColumns(node: unknown, columns: PgColumn[]): void {
  if (isColumnChunk(node)) {
    columns.push(node);
    return;
  }
  if (isSqlChunk(node)) {
    for (const chunk of node.queryChunks) {
      collectColumns(chunk, columns);
    }
  }
}

/**
 * Describes a drizzle `eq`/`and(eq, eq, ...)` condition as
 * `["table.column", "table.column", ...]` so tests can assert which columns
 * a join actually compares without needing a real database — a mock that
 * returns fixed rows regardless of the condition would otherwise pass even
 * if the join key were wrong (e.g. comparing the recipient's own id instead
 * of the actor's).
 */
export function describeEqCondition(condition: SQL): string[] {
  const columns: PgColumn[] = [];
  collectColumns(condition, columns);
  return columns.map(
    (column) => `${getTableName(column.table)}.${column.name}`,
  );
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
