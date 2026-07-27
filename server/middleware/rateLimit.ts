import type { H3Event } from "h3";
import { RATE_LIMIT_POLICIES } from "../utils/rateLimitPolicies";
import { rateLimitStore } from "../utils/rateLimitStore";
import type { RateLimitResult } from "../utils/rateLimitStore";

// Runs after server/middleware/auth.ts (Nitro executes server/middleware/*
// alphabetically, and "auth" sorts before "rateLimit"), so for every policied
// route below, event.context.userId is already set — auth.ts throws its own
// 401 first if the bearer token is missing or invalid.
function resolveRouteKey(event: H3Event): string {
  const pathWithoutQuery = event.path.split("?")[0];
  return `${event.method} ${pathWithoutQuery}`;
}

/**
 * Identifies the caller for rate-limit bucketing. All three policied routes
 * require a verified bearer token (see the module comment above), so this
 * resolves to the authenticated user in practice. The IP fallback only
 * exists to guard a future policy entry on an unauthenticated route; if the
 * IP itself is unavailable (rare — Netlify sets x-forwarded-for on every
 * production request), every such request shares one "anonymous" bucket
 * rather than going unmetered entirely.
 */
function resolveIdentifier(event: H3Event): string {
  if (event.context.userId) {
    return `user:${event.context.userId}`;
  }
  const requestIp = getRequestIP(event, { xForwardedFor: true });
  return requestIp ? `ip:${requestIp}` : "anonymous";
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
