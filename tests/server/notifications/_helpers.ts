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
 * Exposes every intermediate spy (rather than just `select`) so a test can
 * assert on the actual join/filter conditions, not just the canned rows — a
 * mock returning fixed rows regardless of the arguments passed to it would
 * otherwise pass even if the query joined on the wrong column, scoped to the
 * wrong user, or dropped the ordering/limit entirely.
 */
export function makeSelectChain(rows: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const secondLeftJoin = vi.fn().mockReturnValue({ where });
  const firstLeftJoin = vi.fn().mockReturnValue({ leftJoin: secondLeftJoin });
  const from = vi.fn().mockReturnValue({ leftJoin: firstLeftJoin });
  const select = vi.fn().mockReturnValue({ from });
  return { select, firstLeftJoin, secondLeftJoin, where, orderBy, limit };
}

interface ParamChunk {
  value: unknown;
}

function isColumnChunk(value: unknown): value is PgColumn {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "table" in value
  );
}

function isParamChunk(value: unknown): value is ParamChunk {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    "encoder" in value &&
    !("table" in value)
  );
}

function isSqlChunk(value: unknown): value is SQL {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as SQL).queryChunks)
  );
}

function collectComparisonParts(node: unknown, parts: string[]): void {
  if (isColumnChunk(node)) {
    parts.push(`${getTableName(node.table)}.${node.name}`);
    return;
  }
  if (isParamChunk(node)) {
    parts.push(`literal:${JSON.stringify(node.value)}`);
    return;
  }
  if (isSqlChunk(node)) {
    for (const chunk of node.queryChunks) {
      collectComparisonParts(chunk, parts);
    }
  }
}

/**
 * Describes a drizzle `eq`/`and(eq, eq, ...)` condition as a flat list of
 * `"table.column"` (compared columns) and `"literal:<value>"` (compared
 * literals) entries, in comparison order, so tests can assert exactly what a
 * join or where clause compares without needing a real database. Column-only
 * comparison isn't enough on its own — e.g. `eq(userPreferences.publicProfile,
 * true)` and `eq(userPreferences.publicProfile, false)` compare the same
 * column, so the literal must be asserted too to catch a flipped gate.
 */
export function describeEqCondition(condition: SQL): string[] {
  const parts: string[] = [];
  collectComparisonParts(condition, parts);
  return parts;
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
