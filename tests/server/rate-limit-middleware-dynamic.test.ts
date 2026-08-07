/**
 * End-to-end guard for the dynamic-route fix (wanderist#125): with a dynamic
 * policy configured, the middleware must meter every concrete id under the
 * one matched pattern, so an attacker can't dodge the limit by walking ids.
 *
 * The policy map and its matcher are mocked (RATE_LIMIT_POLICIES currently
 * ships only static routes, and the drift guard pins that set) while the real
 * buildRoutePatternMatcher does the matching, so this exercises the actual
 * radix matching wired through the real middleware.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

const DYNAMIC_PATTERN = "/api/entries/:id";
const DYNAMIC_POLICY = { limit: 5, windowMs: 60_000 };

const { mockConsume } = vi.hoisted(() => ({ mockConsume: vi.fn() }));

vi.mock("../../server/utils/rateLimitStore", () => ({
  RateLimitStore: vi.fn().mockImplementation(function MockRateLimitStore() {
    return { consume: mockConsume };
  }),
}));

vi.mock("../../server/utils/rateLimitPolicies", async () => {
  const actual = await vi.importActual<
    typeof import("../../server/utils/rateLimitPolicies")
  >("../../server/utils/rateLimitPolicies");
  return {
    ...actual,
    RATE_LIMIT_POLICIES: { "GET /api/entries/:id": DYNAMIC_POLICY },
    matchPolicyRoutePattern: actual.buildRoutePatternMatcher([DYNAMIC_PATTERN]),
  };
});

Object.assign(globalThis, {
  setResponseHeader: vi.fn(),
  getRequestIP: vi.fn(() => undefined),
  getHeader: vi.fn(() => undefined),
});

const { default: rateLimitMiddleware } =
  await import("../../server/middleware/rateLimit");

interface FakeEvent {
  path: string;
  method: string;
  context: { userId?: string };
}

function buildEvent(path: string, method: string, userId?: string): FakeEvent {
  return { path, method, context: { userId } };
}

const FIXED_NOW = 1_700_000_000_000;

describe("rate limit middleware — dynamic routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReturnValue({
      allowed: true,
      limit: DYNAMIC_POLICY.limit,
      remaining: DYNAMIC_POLICY.limit - 1,
      resetAt: FIXED_NOW + DYNAMIC_POLICY.windowMs,
    });
  });

  it("meters two different ids under the one matched pattern bucket", () => {
    rateLimitMiddleware(buildEvent("/api/entries/1", "GET", "user-1") as never);
    rateLimitMiddleware(buildEvent("/api/entries/2", "GET", "user-1") as never);

    // Same route-key portion for both ids: the enumeration hole in #125 is
    // closed. On main each id would produce a distinct "GET /api/entries/N"
    // key, so neither call would ever share a bucket.
    expect(mockConsume).toHaveBeenNthCalledWith(
      1,
      "GET /api/entries/:id:user:user-1",
      DYNAMIC_POLICY,
    );
    expect(mockConsume).toHaveBeenNthCalledWith(
      2,
      "GET /api/entries/:id:user:user-1",
      DYNAMIC_POLICY,
    );
  });

  it("still isolates the pattern bucket per user", () => {
    rateLimitMiddleware(buildEvent("/api/entries/1", "GET", "user-1") as never);
    rateLimitMiddleware(buildEvent("/api/entries/9", "GET", "user-2") as never);

    expect(mockConsume).toHaveBeenNthCalledWith(
      1,
      "GET /api/entries/:id:user:user-1",
      DYNAMIC_POLICY,
    );
    expect(mockConsume).toHaveBeenNthCalledWith(
      2,
      "GET /api/entries/:id:user:user-2",
      DYNAMIC_POLICY,
    );
  });

  it("does not meter the dynamic route under an unpolicied method", () => {
    rateLimitMiddleware(
      buildEvent("/api/entries/1", "DELETE", "user-1") as never,
    );

    expect(mockConsume).not.toHaveBeenCalled();
  });
});
