/**
 * Unit tests for server/middleware/rateLimit.ts.
 *
 * The RateLimitStore class is mocked (the middleware constructs its own
 * instance as the composition root — see the module comment there) so these
 * tests exercise only the middleware's route matching, identifier
 * resolution, header-setting, and 429 behavior — not the counting algorithm
 * itself (covered by rate-limit-store.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

const { mockConsume, mockSetResponseHeader, mockGetRequestIP, mockGetHeader } =
  vi.hoisted(() => ({
    mockConsume: vi.fn(),
    mockSetResponseHeader: vi.fn(),
    mockGetRequestIP: vi.fn(),
    mockGetHeader: vi.fn(),
  }));

vi.mock("../../server/utils/rateLimitStore", () => ({
  RateLimitStore: vi.fn().mockImplementation(function MockRateLimitStore() {
    return { consume: mockConsume };
  }),
}));

Object.assign(globalThis, {
  setResponseHeader: mockSetResponseHeader,
  getRequestIP: mockGetRequestIP,
  getHeader: mockGetHeader,
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

const ALLOWED_RESULT = {
  allowed: true,
  limit: 20,
  remaining: 19,
  resetAt: FIXED_NOW + 60_000,
};

const REJECTED_RESULT = {
  allowed: false,
  limit: 20,
  remaining: 0,
  resetAt: FIXED_NOW + 30_000,
};

const ORIGINAL_NETLIFY_ENV = process.env.NETLIFY;

describe("rate limit middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockConsume.mockReturnValue(ALLOWED_RESULT);
    // h3's real getRequestIP returns `string | undefined`, never `null` —
    // matched here so the test exercises the actual runtime shape.
    mockGetRequestIP.mockReturnValue(undefined);
    mockGetHeader.mockReturnValue(undefined);
    // Default to "not on Netlify" so the Netlify-only header path is opt-in
    // per test, matching local/dev/CI where it's genuinely unset.
    delete process.env.NETLIFY;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_NETLIFY_ENV === undefined) {
      delete process.env.NETLIFY;
    } else {
      process.env.NETLIFY = ORIGINAL_NETLIFY_ENV;
    }
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
    // ALLOWED_RESULT.resetAt is FIXED_NOW + 60_000, pinned via fake timers.
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "RateLimit-Reset",
      "60",
    );
  });

  it("clamps RateLimit-Reset to 0 when resetAt is already in the past", () => {
    mockConsume.mockReturnValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: FIXED_NOW - 5_000,
    });
    const event = buildEvent("/api/media", "POST", "user-1");

    rateLimitMiddleware(event as never);

    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "RateLimit-Reset",
      "0",
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

  it("strips a trailing slash before matching a policy", () => {
    const event = buildEvent("/api/media/", "POST", "user-1");

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("POST /api/media:user:user-1", {
      limit: 20,
      windowMs: 60_000,
    });
  });

  it("prefers Netlify's client-IP header over getRequestIP when actually running on Netlify", () => {
    process.env.NETLIFY = "true";
    mockGetHeader.mockReturnValue("198.51.100.9");
    mockGetRequestIP.mockReturnValue("10.0.0.1");
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockGetHeader).toHaveBeenCalledWith(
      event,
      "x-nf-client-connection-ip",
    );
    expect(mockConsume).toHaveBeenCalledWith(
      "GET /api/search:ip:198.51.100.9",
      { limit: 60, windowMs: 60_000 },
    );
    expect(mockGetRequestIP).not.toHaveBeenCalled();
  });

  it("ignores the Netlify client-IP header when not running on Netlify, since it isn't trustworthy off-platform", () => {
    // process.env.NETLIFY is unset by default (see beforeEach).
    mockGetHeader.mockReturnValue("198.51.100.9");
    mockGetRequestIP.mockReturnValue("203.0.113.5");
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockGetHeader).not.toHaveBeenCalled();
    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:ip:203.0.113.5", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("falls back to getRequestIP when running on Netlify but the header is absent", () => {
    process.env.NETLIFY = "true";
    mockGetHeader.mockReturnValue(undefined);
    mockGetRequestIP.mockReturnValue("203.0.113.5");
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:ip:203.0.113.5", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("falls back to a shared anonymous bucket when no IP is resolvable", () => {
    mockGetHeader.mockReturnValue(undefined);
    mockGetRequestIP.mockReturnValue(undefined);
    const event = buildEvent("/api/search", "GET", undefined);

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith("GET /api/search:anonymous", {
      limit: 60,
      windowMs: 60_000,
    });
  });

  it("does not limit a policied path under a different HTTP method", () => {
    const event = buildEvent("/api/media", "GET", "user-1");

    rateLimitMiddleware(event as never);

    expect(mockConsume).not.toHaveBeenCalled();
  });

  it("applies the hourly Instagram import policy", () => {
    const event = buildEvent(
      "/api/connections/instagram/import",
      "POST",
      "user-1",
    );

    rateLimitMiddleware(event as never);

    expect(mockConsume).toHaveBeenCalledWith(
      "POST /api/connections/instagram/import:user:user-1",
      { limit: 3, windowMs: 3_600_000 },
    );
  });

  it("returns a 429 with Retry-After when the limit is exceeded", () => {
    mockConsume.mockReturnValue(REJECTED_RESULT);
    const event = buildEvent("/api/media", "POST", "user-1");

    expect(() => rateLimitMiddleware(event as never)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    );

    // REJECTED_RESULT.resetAt is FIXED_NOW + 30_000, pinned via fake timers.
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      event,
      "Retry-After",
      "30",
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
