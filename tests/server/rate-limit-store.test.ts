/**
 * Unit tests for server/utils/rateLimitStore.ts.
 *
 * Each test constructs its own RateLimitStore instance (rather than the
 * exported singleton) so counters never leak between test cases, and passes
 * an explicit `now` to `consume()` to control window timing deterministically
 * without fake timers.
 */
import { describe, it, expect } from "vitest";
import { RateLimitStore } from "../../server/utils/rateLimitStore";

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
});
