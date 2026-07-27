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
 *
 * Fixed windows also allow a boundary burst: a caller can send up to `limit`
 * requests in the last instant of one window and `limit` more in the first
 * instant of the next, i.e. up to 2x `limit` within a short span around the
 * boundary. That is inherent to the fixed-window algorithm and is accepted
 * here — a sliding-window log would remove it at the cost of unbounded
 * per-key memory (one timestamp per request instead of one counter).
 */

// How often a consume() call is allowed to trigger a sweep for stale windows.
// Purely a cost-control knob (avoid scanning the map on every request); it
// has no relationship to any policy's window length.
const CLEANUP_INTERVAL_MS = 5 * 60_000;

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
   * @param staleAfterMs A window untouched for this long is evicted during
   *   the next cleanup sweep. Callers must pass a value comfortably larger
   *   than the longest `windowMs` among the policies they'll consume with —
   *   otherwise a long-running window can be evicted (and its count silently
   *   reset) before it naturally expires. See server/utils/rateLimitPolicies.ts,
   *   which derives this from the policy map itself so the two can't drift.
   */
  constructor(private readonly staleAfterMs: number) {}

  /**
   * Number of distinct keys currently tracked. Exposed for tests to verify
   * stale-window cleanup directly: once `staleAfterMs >= windowMs` (the
   * documented, correct configuration), eviction and ordinary window expiry
   * are behaviorally identical through `consume()`'s return value alone —
   * this getter is the only way to observe cleanup itself rather than
   * inferring it.
   */
  get windowCount(): number {
    return this.windows.size;
  }

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
      const isStale = now - state.windowStart >= this.staleAfterMs;
      if (!isStale) {
        continue;
      }
      this.windows.delete(key);
    }
  }
}
