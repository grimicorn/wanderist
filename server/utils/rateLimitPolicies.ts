import type { RateLimitPolicy } from "./rateLimitStore";

export const ONE_MINUTE_MS = 60_000;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

/**
 * Per-route rate limit policies, keyed by "<HTTP method> <path>" exactly as
 * seen on `event.path` with the query string stripped (see
 * server/middleware/rateLimit.ts's `resolveRouteKey`).
 *
 * The middleware matches every request against this map, so adding a limit
 * to a new route is a one-line entry here — no route handler changes
 * required. A route with no entry is simply not rate-limited.
 *
 * Scoped to wanderist#89's three named cost-metered/abuse-prone endpoints;
 * see each entry for why its limit and window were chosen.
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
