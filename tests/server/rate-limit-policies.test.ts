/**
 * Guards RATE_LIMIT_POLICIES against silent drift: each policy key is a
 * plain "<METHOD> <path>" string matched against event.path (see
 * server/middleware/rateLimit.ts), with nothing else tying it to a real
 * route. If a targeted route file is ever renamed or moved, the policy key
 * stops matching anything and the rate limit silently stops applying — no
 * test would fail and no error would be logged. This test fails loud instead
 * by asserting every configured key resolves to an actual handler file.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { RATE_LIMIT_POLICIES } from "../../server/utils/rateLimitPolicies";

const SERVER_API_DIR = resolve(__dirname, "../../server/api");
const API_PATH_PREFIX = "/api/";

// wanderist#89's three named targets. Pinned explicitly (rather than only
// walking whatever keys happen to exist) so that deleting an entry — the
// loudest form of drift — fails this test instead of it passing vacuously
// over an empty or shrunk map.
const EXPECTED_POLICY_KEYS = [
  "POST /api/media",
  "POST /api/connections/instagram/import",
  "GET /api/search",
];

function candidateHandlerPaths(method: string, apiPath: string): string[] {
  const routeSegment = apiPath.slice(API_PATH_PREFIX.length);
  const methodSuffix = method.toLowerCase();

  return [
    resolve(SERVER_API_DIR, `${routeSegment}.${methodSuffix}.ts`),
    resolve(SERVER_API_DIR, `${routeSegment}/index.${methodSuffix}.ts`),
  ];
}

describe("RATE_LIMIT_POLICIES route drift guard", () => {
  it("covers exactly the intended routes", () => {
    expect(Object.keys(RATE_LIMIT_POLICIES).sort()).toEqual(
      [...EXPECTED_POLICY_KEYS].sort(),
    );
  });

  it("resolves every policy key to an existing route handler file", () => {
    for (const policyKey of Object.keys(RATE_LIMIT_POLICIES)) {
      const [method, apiPath] = policyKey.split(" ");
      const candidates = candidateHandlerPaths(method, apiPath);
      const matchesAHandler = candidates.some((candidate) =>
        existsSync(candidate),
      );

      expect(
        matchesAHandler,
        `Expected "${policyKey}" to resolve to one of:\n${candidates.join("\n")}`,
      ).toBe(true);
    }
  });
});
