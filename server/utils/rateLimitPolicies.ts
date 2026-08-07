import { createRouter } from "radix3";
import type { RateLimitPolicy } from "./rateLimitStore";

export const ONE_MINUTE_MS = 60_000;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

/**
 * Per-route rate limit policies, keyed by "<HTTP method> <route pattern>",
 * where the pattern uses Nitro's file-route syntax (`:id` for a dynamic
 * segment, `**` for a wildcard) — the same syntax `server/api/[id].get.ts`
 * compiles to. The middleware resolves each request's path to the pattern it
 * matches before looking up its policy (see
 * server/middleware/rateLimit.ts's `resolveRouteKey`), so a dynamic route is
 * metered per pattern, not per concrete id — `/api/entries/1` and
 * `/api/entries/2` share one bucket rather than minting a distinct key each.
 *
 * The middleware matches every request against this map, so adding a limit
 * to a new route is a one-line entry here — no route handler changes
 * required. A route with no entry is simply not rate-limited.
 *
 * Scoped to wanderist#89's three named cost-metered/abuse-prone endpoints;
 * see each entry for why its limit and window were chosen. All three are
 * currently static paths; the pattern matching exists so a future dynamic
 * route can be added here and metered correctly.
 */
export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  // Upload runs image dimension probing + thumbnail generation (sharp) and
  // writes a blob to storage — CPU and storage cost on every call. 20/minute
  // covers a bulk photo add (e.g. a trip recap) without letting a script
  // hammer the storage tier.
  "POST /api/media": { limit: 20, windowMs: ONE_MINUTE_MS },

  // Heaviest of the three: fetches the user's Instagram media, downloads
  // each photo from Instagram's CDN, and writes an entry+media+photo row per
  // item inside its own DB transaction. A user has no legitimate reason to
  // re-run this more than a couple of times an hour.
  "POST /api/connections/instagram/import": {
    limit: 3,
    windowMs: ONE_HOUR_MS,
  },

  // Runs a multi-table query (places/trips/entries/people) per call. Kept
  // generous relative to realistic debounced-typeahead usage while still
  // capping scripted scraping.
  "GET /api/search": { limit: 60, windowMs: ONE_MINUTE_MS },
};

/** The path portion of a policy key ("POST /api/media" -> "/api/media"). */
function routePatternOf(policyKey: string): string {
  return policyKey.slice(policyKey.indexOf(" ") + 1);
}

/**
 * Resolves a request path to the route pattern it belongs to (or undefined
 * when it belongs to none). Returned as a closure over a prebuilt radix
 * router so matching is a tree lookup, not a per-request scan.
 */
export type RoutePatternMatcher = (path: string) => string | undefined;

/**
 * Builds a matcher over `routePatterns` using the same radix3 router Nitro
 * and h3 route requests with. That gives correct static-over-dynamic
 * precedence (`/api/entries/on-this-day` wins over `/api/entries/:id`) and
 * trailing-slash normalization for free — the reason this defers to the
 * router instead of string-munching path segments. Isolated from the policy
 * map below so dynamic-pattern matching is unit-testable without a live
 * dynamic policy in production.
 */
export function buildRoutePatternMatcher(
  routePatterns: string[],
): RoutePatternMatcher {
  const router = createRouter<{ pattern: string }>();
  for (const pattern of routePatterns) {
    router.insert(pattern, { pattern });
  }
  return (path) => router.lookup(path)?.pattern;
}

/** Matcher over the route patterns that actually carry a policy. */
export const matchPolicyRoutePattern: RoutePatternMatcher =
  buildRoutePatternMatcher(
    Object.keys(RATE_LIMIT_POLICIES).map(routePatternOf),
  );
