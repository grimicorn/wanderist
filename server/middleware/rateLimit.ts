import type { H3Event } from "h3";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_CLEANUP_STALE_AFTER_MS,
} from "../utils/rateLimitPolicies";
import { RateLimitStore } from "../utils/rateLimitStore";
import type { RateLimitResult } from "../utils/rateLimitStore";

// This is the composition root: server/utils/rateLimitStore.ts stays a
// generic, policy-agnostic counter; server/utils/rateLimitPolicies.ts stays
// pure config; this is the one place that wires a store instance to the
// policy map, sized by the policies' own longest window.
const rateLimitStore = new RateLimitStore(RATE_LIMIT_CLEANUP_STALE_AFTER_MS);

// Netlify's edge sets this header to the caller's true IP and it cannot be
// overridden by the client, unlike X-Forwarded-For, which an unauthenticated
// caller can set to an arbitrary value per request to land in a fresh bucket
// every time and defeat the limit entirely.
const NETLIFY_CLIENT_IP_HEADER = "x-nf-client-connection-ip";

// Runs after server/middleware/auth.ts (Nitro executes server/middleware/*
// alphabetically, and "auth" sorts before "rateLimit"), so for every policied
// route below, event.context.userId is already set — auth.ts throws its own
// 401 first if the bearer token is missing or invalid.
function resolveRouteKey(event: H3Event): string {
  const pathWithoutQuery = event.path.split("?")[0];
  const pathWithoutTrailingSlash = pathWithoutQuery.replace(/\/+$/, "");
  return `${event.method} ${pathWithoutTrailingSlash}`;
}

/**
 * The caller's IP, preferring Netlify's own client-IP header (not
 * spoofable by the request) over the raw socket address that
 * `getRequestIP(event)` falls back to locally/in dev, where there's no
 * Netlify edge in front of the request.
 */
function resolveClientIp(event: H3Event): string | null {
  const netlifyClientIp = getHeader(event, NETLIFY_CLIENT_IP_HEADER);
  if (netlifyClientIp) {
    return netlifyClientIp;
  }
  return getRequestIP(event);
}

/**
 * Identifies the caller for rate-limit bucketing. All three policied routes
 * require a verified bearer token (see the module comment above), so this
 * resolves to the authenticated user in practice. The IP fallback only
 * exists to guard a future policy entry on an unauthenticated route; if the
 * IP itself is unavailable, every such request shares one "anonymous" bucket
 * rather than going unmetered entirely.
 */
function resolveIdentifier(event: H3Event): string {
  if (event.context.userId) {
    return `user:${event.context.userId}`;
  }
  const clientIp = resolveClientIp(event);
  return clientIp ? `ip:${clientIp}` : "anonymous";
}

function secondsUntil(epochMs: number, now: number): number {
  return Math.max(Math.ceil((epochMs - now) / 1000), 0);
}

function applyRateLimitHeaders(event: H3Event, result: RateLimitResult): void {
  const now = Date.now();
  setResponseHeader(event, "RateLimit-Limit", String(result.limit));
  setResponseHeader(event, "RateLimit-Remaining", String(result.remaining));
  setResponseHeader(
    event,
    "RateLimit-Reset",
    String(secondsUntil(result.resetAt, now)),
  );

  if (result.allowed) {
    return;
  }
  setResponseHeader(
    event,
    "Retry-After",
    String(secondsUntil(result.resetAt, now)),
  );
}

export default defineEventHandler((event) => {
  const routeKey = resolveRouteKey(event);
  const policy = RATE_LIMIT_POLICIES[routeKey];
  if (!policy) {
    return;
  }

  const identifier = resolveIdentifier(event);
  const result = rateLimitStore.consume(`${routeKey}:${identifier}`, policy);
  applyRateLimitHeaders(event, result);

  if (result.allowed) {
    return;
  }
  throw createError({ statusCode: 429, statusMessage: "Too Many Requests" });
});
