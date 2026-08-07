/**
 * Guards RATE_LIMIT_POLICIES against silent drift: each policy key is a
 * "<METHOD> <route pattern>" string the middleware resolves a request path
 * against (see server/middleware/rateLimit.ts), with nothing else tying it to
 * a real route. If a targeted route file is ever renamed or moved, the policy
 * key stops matching anything and the rate limit silently stops applying — no
 * test would fail and no error would be logged. This test fails loud instead
 * by asserting every configured key resolves to an actual handler file.
 * candidateHandlerPaths translates a dynamic `:id` pattern back to its `[id]`
 * file, so the guard also covers a future dynamic policy.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  RATE_LIMIT_POLICIES,
  buildRoutePatternMatcher,
  matchPolicyRoutePattern,
} from "../../server/utils/rateLimitPolicies";

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

// Nitro accepts a method-suffixed handler (search.get.ts) or a method-agnostic
// one (search.ts) that handles every verb itself, at either the file or the
// directory-index level — all four shapes are valid places a route could
// legitimately live.
function candidateHandlerPaths(method: string, apiPath: string): string[] {
  if (!apiPath.startsWith(API_PATH_PREFIX)) {
    throw new Error(
      `Policy key "${method} ${apiPath}" is outside ${API_PATH_PREFIX}; extend candidateHandlerPaths to cover it.`,
    );
  }
  // Nitro compiles a `[id]` file to a `:id` route pattern and a `[...slug]`
  // file to `**`, so translate the pattern back to file syntax before
  // resolving it to a path on disk.
  const routeSegment = apiPath
    .slice(API_PATH_PREFIX.length)
    .replace(/:([^/]+)/g, "[$1]")
    .replace(/\*\*:?([^/]*)/g, (_match, name) => `[...${name || "slug"}]`);
  const methodSuffix = method.toLowerCase();

  return [
    resolve(SERVER_API_DIR, `${routeSegment}.${methodSuffix}.ts`),
    resolve(SERVER_API_DIR, `${routeSegment}/index.${methodSuffix}.ts`),
    resolve(SERVER_API_DIR, `${routeSegment}.ts`),
    resolve(SERVER_API_DIR, `${routeSegment}/index.ts`),
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

describe("buildRoutePatternMatcher", () => {
  it("collapses every concrete id of a dynamic route onto one pattern", () => {
    const matchRoute = buildRoutePatternMatcher(["/api/users/:id"]);

    // The core fix: enumerating ids can no longer mint a distinct rate-limit
    // key per id — they all resolve to the same pattern, so one bucket.
    expect(matchRoute("/api/users/1")).toBe("/api/users/:id");
    expect(matchRoute("/api/users/2")).toBe("/api/users/:id");
    expect(matchRoute("/api/users/abc-def")).toBe("/api/users/:id");
  });

  it("prefers a static route over an overlapping dynamic one", () => {
    const matchRoute = buildRoutePatternMatcher([
      "/api/entries/:id",
      "/api/entries/on-this-day",
    ]);

    expect(matchRoute("/api/entries/on-this-day")).toBe(
      "/api/entries/on-this-day",
    );
    expect(matchRoute("/api/entries/123")).toBe("/api/entries/:id");
  });

  it("matches a dynamic segment nested under a static suffix", () => {
    const matchRoute = buildRoutePatternMatcher(["/api/media/:id/thumbnail"]);

    expect(matchRoute("/api/media/9/thumbnail")).toBe(
      "/api/media/:id/thumbnail",
    );
  });

  it("matches a wildcard pattern across any number of trailing segments", () => {
    const matchRoute = buildRoutePatternMatcher(["/api/proxy/**"]);

    expect(matchRoute("/api/proxy/a/b/c")).toBe("/api/proxy/**");
  });

  it("normalizes a trailing slash before matching", () => {
    const matchRoute = buildRoutePatternMatcher(["/api/users/:id"]);

    expect(matchRoute("/api/users/1/")).toBe("/api/users/:id");
  });

  it("returns undefined for a path outside every pattern", () => {
    const matchRoute = buildRoutePatternMatcher(["/api/users/:id"]);

    expect(matchRoute("/api/trips")).toBeUndefined();
  });

  it("throws when two patterns collide on shape so no limit silently vanishes", () => {
    expect(() =>
      buildRoutePatternMatcher(["/api/trips/:id", "/api/trips/:tripId"]),
    ).toThrow(/collide/);
  });
});

describe("matchPolicyRoutePattern", () => {
  it("resolves each policied static path to itself", () => {
    expect(matchPolicyRoutePattern("/api/media")).toBe("/api/media");
    expect(matchPolicyRoutePattern("/api/search")).toBe("/api/search");
    expect(matchPolicyRoutePattern("/api/connections/instagram/import")).toBe(
      "/api/connections/instagram/import",
    );
  });

  it("returns undefined for an unpolicied path", () => {
    expect(matchPolicyRoutePattern("/api/trips")).toBeUndefined();
    expect(matchPolicyRoutePattern("/api/entries/123")).toBeUndefined();
  });
});
