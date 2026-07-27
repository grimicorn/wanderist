/**
 * Unit tests for server/utils/rateLimitStore.ts.
 *
 * Each test constructs its own RateLimitStore instance (rather than sharing
 * one) so counters never leak between test cases, and passes an explicit
 * `now` to `consume()` to control window and cleanup timing deterministically
 * without fake timers.
 */
import { describe, it, expect } from "vitest";
import {
  RateLimitStore,
  CLEANUP_INTERVAL_MS,
  MAX_TRACKED_WINDOWS,
  EVICTION_TARGET_LOAD_FACTOR,
} from "../../server/utils/rateLimitStore";

const POLICY = { limit: 3, windowMs: 60_000 };
const WINDOW_START = 1_000_000;

describe("RateLimitStore", () => {
  it("allows requests under the limit", () => {
    const store = new RateLimitStore();

    const first = store.consume("key", POLICY, WINDOW_START);
    const second = store.consume("key", POLICY, WINDOW_START);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("rejects the request that exceeds the limit", () => {
    const store = new RateLimitStore();

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
    const store = new RateLimitStore();

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
    const store = new RateLimitStore();

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
    const store = new RateLimitStore();

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

  // These use RateLimitStore.windowCount (an internal-state getter meant for
  // tests) rather than consume()'s return value: once a window has expired,
  // eviction and ordinary expiry look identical through consume() alone —
  // windowCount is the only way to observe the cleanup sweep itself.
  //
  // Staleness is per-key: a window is evicted once untouched for 2x its OWN
  // policy's windowMs (mirrors the store's internal CLEANUP_SAFETY_MULTIPLIER,
  // which isn't exported since it's an implementation detail — these tests
  // pick windowMs values that make that horizon land clearly before/after
  // the imported CLEANUP_INTERVAL_MS below).
  describe("stale window cleanup", () => {
    it("evicts a key only once it has been untouched for 2x its own windowMs", () => {
      // windowMs=250_000 -> stale horizon of 500_000, comfortably straddling
      // two CLEANUP_INTERVAL_MS (300_000) sweeps.
      const longPolicy = { limit: 3, windowMs: 250_000 };
      const store = new RateLimitStore();

      store.consume("key-a", longPolicy, WINDOW_START);
      expect(store.windowCount).toBe(1);

      // A sweep runs here (past the cleanup interval), but key-a's age
      // (CLEANUP_INTERVAL_MS = 300_000) is still under its 500_000 stale
      // horizon, so it survives.
      const firstSweepTime = WINDOW_START + CLEANUP_INTERVAL_MS;
      store.consume("key-b", longPolicy, firstSweepTime);
      expect(store.windowCount).toBe(2);

      // Advance past both key-a's stale horizon and another full cleanup
      // interval (so the gate has reopened since the sweep at
      // firstSweepTime). The next sweep must drop key-a specifically: if it
      // didn't, adding key-c would bring the count to 3 instead of 2.
      const secondSweepTime = firstSweepTime + CLEANUP_INTERVAL_MS;
      store.consume("key-c", longPolicy, secondSweepTime);
      expect(store.windowCount).toBe(2);
    });

    it("does not sweep more than once per cleanup interval", () => {
      // windowMs=50 -> stale horizon of 100, trivially small so key-a is
      // already stale by the second consume below if a sweep were to run.
      const shortPolicy = { limit: 3, windowMs: 50 };
      const store = new RateLimitStore();

      store.consume("key-a", shortPolicy, WINDOW_START);

      // Well inside one cleanup interval of the first consume, so the sweep
      // must be skipped and key-a must survive alongside the new key.
      store.consume("key-b", shortPolicy, WINDOW_START + 200);

      expect(store.windowCount).toBe(2);
    });

    it("keeps a key touched within its stale horizon across a sweep", () => {
      const longPolicy = { limit: 3, windowMs: 250_000 };
      const store = new RateLimitStore();

      store.consume("live-key", longPolicy, WINDOW_START);

      // Trigger a sweep well after the cleanup interval but before
      // "live-key" (touched at WINDOW_START) crosses its 500_000 stale
      // horizon.
      const sweepTime = WINDOW_START + CLEANUP_INTERVAL_MS;
      store.consume("other-key", longPolicy, sweepTime);

      expect(store.windowCount).toBe(2);
    });

    it("forces a sweep once the tracked-window count hits the cap, even inside the interval gate", () => {
      // A tiny windowMs keeps every one of these keys well past its own
      // stale horizon by the time the cap-triggering consume happens 30ms
      // later.
      const tinyPolicy = { limit: 3, windowMs: 10 };
      const store = new RateLimitStore();

      for (let index = 0; index < MAX_TRACKED_WINDOWS; index += 1) {
        store.consume(`key-${index}`, tinyPolicy, WINDOW_START);
      }
      expect(store.windowCount).toBe(MAX_TRACKED_WINDOWS);

      // Well inside CLEANUP_INTERVAL_MS of the keys above, so the time gate
      // alone would skip a sweep — but the cap is now met, forcing one. All
      // prior keys are long past their 20ms stale horizon, so only the new
      // key should remain.
      store.consume("one-more-key", tinyPolicy, WINDOW_START + 30);
      expect(store.windowCount).toBe(1);
    });

    it("evicts a batch of least-recently-touched windows to stay under the cap when every tracked key is still live", () => {
      // Long windowMs keeps every key well within its own stale horizon, so
      // the staleness sweep alone cannot bring the map back under the cap —
      // only the size-based eviction fallback can. Each key is consumed once,
      // in order, so map iteration order (insertion order, since nothing is
      // re-touched) doubles as least-recently-touched-first order.
      const longPolicy = { limit: 3, windowMs: 250_000 };
      const store = new RateLimitStore();

      for (let index = 0; index < MAX_TRACKED_WINDOWS; index += 1) {
        store.consume(`key-${index}`, longPolicy, WINDOW_START + index);
      }
      expect(store.windowCount).toBe(MAX_TRACKED_WINDOWS);

      store.consume(
        "one-more-key",
        longPolicy,
        WINDOW_START + MAX_TRACKED_WINDOWS,
      );

      // Adding one more key while every existing key is still live must not
      // grow the map past the cap, and eviction must trim a whole batch down
      // to EVICTION_TARGET_LOAD_FACTOR of the cap (not just one key over) so
      // this path doesn't recur on every request while a caller keeps
      // minting distinct keys at the cap.
      const expectedSizeAfterEviction =
        Math.floor(MAX_TRACKED_WINDOWS * EVICTION_TARGET_LOAD_FACTOR) + 1;
      expect(store.windowCount).toBe(expectedSizeAfterEviction);
      // The very first key (least recently touched) must be among those
      // evicted: a fresh window (remaining === limit - 1) rather than its
      // original count being incremented (which would report limit - 2).
      const oldestKeyWasEvicted =
        store.consume("key-0", longPolicy, WINDOW_START + MAX_TRACKED_WINDOWS)
          .remaining ===
        longPolicy.limit - 1;
      expect(oldestKeyWasEvicted).toBe(true);
      // The most recently touched key before the trigger must survive: its
      // original count increments instead of restarting a fresh window.
      const newestKeySurvived =
        store.consume(
          `key-${MAX_TRACKED_WINDOWS - 1}`,
          longPolicy,
          WINDOW_START + MAX_TRACKED_WINDOWS,
        ).remaining ===
        longPolicy.limit - 2;
      expect(newestKeySurvived).toBe(true);
    });
  });
});
