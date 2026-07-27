/**
 * Unit tests for server/middleware/rateLimit.ts.
 *
 * The rate limit store is mocked so these tests exercise only the
 * middleware's route matching, identifier resolution, header-setting, and
 * 429 behavior — not the counting algorithm itself (covered by
 * rate-limit-store.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

const { mockConsume, mockSetResponseHeader, mockGetRequestIP } = vi.hoisted(
  () => ({
    mockConsume: vi.fn(),
    mockSetResponseHeader: vi.fn(),
    mockGetRequestIP: vi.fn(),
  }),
);

vi.mock("../../server/utils/rateLimitStore", () => ({
  rateLimitStore: { consume: mockConsume },
}));

Object.assign(globalThis, {
  setResponseHeader: mockSetResponseHeader,
  getRequestIP: mockGetRequestIP,
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

const ALLOWED_RESULT = {
  allowed: true,
  limit: 20,
  remaining: 19,
  resetAt: Date.now() + 60_000,
};

const REJECTED_RESULT = {
  allowed: false,
  limit: 20,
  remaining: 0,
  resetAt: Date.now() + 30_000,
};

describe("rate limit middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReturnValue(ALLOWED_RESULT);
    mockGetRequestIP.mockReturnValue(null);
  });

  it("skips routes with no configured policy", () => {
    const event = buildEvent("/api/trips", "GET", "user-1");

    const result = rateLimitMiddleware(event as never);

    expect(result).toBeUndefined();
    expect(mockConsume).not.toHaveBeenCalled();
    expect(mockSetResponseHeader).not.toHaveBeenCalled();
  });

  it("keys on the authenticated user for a policied route and sets rate limit headers", () => {
    const event = buildEvent("/api/media", "POST", "user-1");

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("POST /api/media:user:user-1", {
      limit: 20,
      windowMs: 60_000,
    });
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "RateLimit-Limit",
      "20",
    );
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "RateLimit-Remaining",
      "19",
    );
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "RateLimit-Reset",
      expect.any(String),
    );
  });

  it("strips the query string before matching a policy", () => {
    const event = buildEvent("/api/search?q=paris", "GET", "user-1");

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:user:user-1", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("falls back to the request IP when there is no authenticated user", () => {
    mockGetRequestIP.mockReturnValue("203.0.113.5");
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:ip:203.0.113.5", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("falls back to a shared anonymous bucket when no IP is resolvable", () => {
    mockGetRequestIP.mockReturnValue(null);
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:anonymous", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("returns a 429 with Retry-After when the limit is exceeded", () => {
    mockConsume.mockReturnValue(REJECTED_RESULT);
    const event = buildEvent("/api/media", "POST", "user-1");

    expect(() => rateLimitMiddleware(event as never)).toThrow(
      "Too Many Requests",
    );

    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "Retry-After",
      expect.any(String),
    );
  });

  it("isolates rate limit keys per user for the same route", () => {
    rateLimitMiddleware(buildEvent("/api/media", "POST", "user-1") as never);
    rateLimitMiddleware(buildEvent("/api/media", "POST", "user-2") as never);

    expect(mockConsume).toHaveBeenNthCalledWith(
      1,
      "POST /api/media:user:user-1",
      { limit: 20, windowMs: 60_000 },
    );
    expect(mockConsume).toHaveBeenNthCalledWith(
      2,
      "POST /api/media:user:user-2",
      { limit: 20, windowMs: 60_000 },
    );
  });
});
