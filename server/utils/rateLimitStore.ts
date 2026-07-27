/**
 * Fixed-window rate limit counter.
 *
 * BEST-EFFORT ONLY — this app runs on Netlify serverless functions, where
 * each concurrent instance holds its own process memory. A counter here is
 * NOT shared across instances: a client whose requests land on more than one
 * warm instance (or hit a cold start) can exceed the nominal limit. That is
 * accepted as a first pass for wanderist#89 — it still meaningfully throttles
 * the common case (repeated requests reusing the same warm instance) and
 * caps runaway cost from a single script hammering one endpoint, without the
 * latency and operational cost of standing up a shared store (a Postgres
 * counter table or a service like Upstash Redis). If these limits prove too
 * easy to evade in practice, that shared store is the natural next step —
 * swap it in behind this same RateLimitStore shape.
 */

// Bounds memory growth from key churn (e.g. many distinct users/IPs) on a
// long-lived warm instance: periodically drop windows that are stale even
// relative to the longest policy window in use, rather than growing forever.
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const CLEANUP_STALE_AFTER_MS = 60 * 60_000;

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

export class RateLimitStore {
  private readonly windows = new Map<string, WindowState>();
  private lastCleanupAt = 0;

  /**
   * Records one request against `key` under `policy` and reports whether it
   * is within the limit. `now` defaults to Date.now() and is only ever
   * overridden by tests to simulate the passage of time.
   */
  consume(
    key: string,
    policy: RateLimitPolicy,
    now: number = Date.now(),
  ): RateLimitResult {
    this.cleanupStaleWindows(now);

    const state = this.currentWindowFor(key, policy, now);
    state.count += 1;
    this.windows.set(key, state);

    return {
      allowed: state.count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(policy.limit - state.count, 0),
      resetAt: state.windowStart + policy.windowMs,
    };
  }

  private currentWindowFor(
    key: string,
    policy: RateLimitPolicy,
    now: number,
  ): WindowState {
    const existing = this.windows.get(key);
    const windowHasExpired =
      !existing || now - existing.windowStart >= policy.windowMs;

    if (windowHasExpired) {
      return { count: 0, windowStart: now };
    }
    return existing;
  }

  private cleanupStaleWindows(now: number): void {
    const cleanupIsDue = now - this.lastCleanupAt >= CLEANUP_INTERVAL_MS;
    if (!cleanupIsDue) {
      return;
    }
    this.lastCleanupAt = now;

    for (const [key, state] of this.windows) {
      const isStale = now - state.windowStart >= CLEANUP_STALE_AFTER_MS;
      if (!isStale) {
        continue;
      }
      this.windows.delete(key);
    }
  }
}

// Singleton used by server/middleware/rateLimit.ts. Tests that want an
// isolated counter (no shared state across test cases) should construct
// their own `new RateLimitStore()` instead of importing this instance.
export const rateLimitStore = new RateLimitStore();
