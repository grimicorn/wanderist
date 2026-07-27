/**
 * Unit tests for server/utils/rateLimitStore.ts.
 *
 * Each test constructs its own RateLimitStore instance (rather than sharing
 * one) so counters never leak between test cases, and passes an explicit
 * `now` to `consume()` to control window and cleanup timing deterministically
 * without fake timers.
 */
import { describe, it, expect } from "vitest";
import { RateLimitStore } from "../../server/utils/rateLimitStore";

const POLICY = { limit: 3, windowMs: 60_000 };
const WINDOW_START = 1_000_000;

// Comfortably larger than POLICY.windowMs so ordinary window-expiry tests
// never trip the cleanup sweep by accident.
const STALE_AFTER_MS = 10 * POLICY.windowMs;

describe("RateLimitStore", () => {
  it("allows requests under the limit", () => {
    const store = new RateLimitStore(STALE_AFTER_MS);

    const first = store.consume("key", POLICY, WINDOW_START);
    const second = store.consume("key", POLICY, WINDOW_START);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("rejects the request that exceeds the limit", () => {
    const store = new RateLimitStore(STALE_AFTER_MS);

    store.consume("key", POLICY, WINDOW_START);
    store.consume("key", POLICY, WINDOW_START);
    store.consume("key", POLICY, WINDOW_START);
    const fourth = store.consume("key", POLICY, WINDOW_START);

    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.limit).toBe(POLICY.limit);
    expect(fourth.resetAt).toBe(WINDOW_START + POLICY.windowMs);
  });

  it("resets the window once windowMs has elapsed", () => {
    const store = new RateLimitStore(STALE_AFTER_MS);

    store.consume("key", POLICY, WINDOW_START);
    store.consume("key", POLICY, WINDOW_START);
    store.consume("key", POLICY, WINDOW_START);
    const withinWindow = store.consume("key", POLICY, WINDOW_START);
    expect(withinWindow.allowed).toBe(false);

    const afterWindow = store.consume(
      "key",
      POLICY,
      WINDOW_START + POLICY.windowMs,
    );

    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(POLICY.limit - 1);
  });

  it("isolates counters per key", () => {
    const store = new RateLimitStore(STALE_AFTER_MS);

    store.consume("user-a", POLICY, WINDOW_START);
    store.consume("user-a", POLICY, WINDOW_START);
    store.consume("user-a", POLICY, WINDOW_START);
    const userAFourth = store.consume("user-a", POLICY, WINDOW_START);

    const userBFirst = store.consume("user-b", POLICY, WINDOW_START);

    expect(userAFourth.allowed).toBe(false);
    expect(userBFirst.allowed).toBe(true);
    expect(userBFirst.remaining).toBe(POLICY.limit - 1);
  });

  it("allows a boundary burst across a window edge — a known, accepted tradeoff of fixed windows", () => {
    const store = new RateLimitStore(STALE_AFTER_MS);

    // First request anchors the window at WINDOW_START. Fill it right up to
    // its last millisecond.
    store.consume("key", POLICY, WINDOW_START);
    store.consume("key", POLICY, WINDOW_START + POLICY.windowMs - 1);
    const lastInWindow = store.consume(
      "key",
      POLICY,
      WINDOW_START + POLICY.windowMs - 1,
    );
    expect(lastInWindow.allowed).toBe(true);

    // The window anchored at WINDOW_START expires exactly windowMs later —
    // the very next window starts fresh, allowing another full `limit` worth
    // of requests immediately after: up to 2x limit in a short span.
    const firstOfNextWindow = store.consume(
      "key",
      POLICY,
      WINDOW_START + POLICY.windowMs,
    );
    expect(firstOfNextWindow.allowed).toBe(true);
    expect(firstOfNextWindow.remaining).toBe(POLICY.limit - 1);
  });

  // These use RateLimitStore.windowCount (an internal-state getter meant
  // for tests) rather than consume()'s return value: once staleAfterMs >=
  // windowMs (the documented, correct configuration), eviction and ordinary
  // window expiry look identical through consume() alone, since an expired-
  // but-not-yet-evicted window and a freshly-evicted one both start over.
  // windowCount is the only way to observe cleanup itself.
  describe("stale window cleanup", () => {
    const CLEANUP_INTERVAL_MS = 5 * 60_000;

    it("evicts a key only once it has been untouched for staleAfterMs", () => {
      const staleAfterMs = 500_000;
      const store = new RateLimitStore(staleAfterMs);

      store.consume("key-a", POLICY, WINDOW_START);
      expect(store.windowCount).toBe(1);

      // A sweep runs here (past the cleanup interval), but key-a's age
      // (CLEANUP_INTERVAL_MS) is still under staleAfterMs, so it survives.
      const firstSweepTime = WINDOW_START + CLEANUP_INTERVAL_MS;
      store.consume("key-b", POLICY, firstSweepTime);
      expect(store.windowCount).toBe(2);

      // Advance past both key-a's stale horizon AND another full cleanup
      // interval (so the gate has reopened since the last sweep at
      // firstSweepTime). The next sweep must drop key-a specifically: if it
      // didn't, adding key-c would bring the count to 3 instead of 2.
      const afterStaleHorizon =
        Math.max(
          WINDOW_START + staleAfterMs,
          firstSweepTime + CLEANUP_INTERVAL_MS,
        ) + 1;
      store.consume("key-c", POLICY, afterStaleHorizon);
      expect(store.windowCount).toBe(2);
    });

    it("does not sweep more than once per cleanup interval", () => {
      const staleAfterMs = 100;
      const store = new RateLimitStore(staleAfterMs);

      store.consume("key-a", POLICY, WINDOW_START);

      // key-a is already older than staleAfterMs here, so if a sweep ran it
      // would be evicted — but this is well inside one cleanup interval of
      // the first consume, so the sweep must be skipped and key-a must
      // survive alongside the new key.
      store.consume("key-b", POLICY, WINDOW_START + 200);

      expect(store.windowCount).toBe(2);
    });

    it("keeps a key touched within the stale horizon across a sweep", () => {
      const staleAfterMs = 500_000;
      const store = new RateLimitStore(staleAfterMs);

      store.consume("live-key", POLICY, WINDOW_START);

      // Trigger a sweep well after the cleanup interval but before
      // "live-key" (touched at WINDOW_START) crosses the stale horizon.
      const sweepTime = WINDOW_START + CLEANUP_INTERVAL_MS;
      store.consume("other-key", POLICY, sweepTime);

      expect(store.windowCount).toBe(2);
    });
  });
});
