/**
 * Guards the load-bearing assumption documented in
 * server/middleware/rateLimit.ts: Nitro runs server/middleware/* files in
 * alphabetical order, so "auth.ts" (which sets event.context.userId) must
 * sort before "rateLimit.ts". If a future middleware file is added or
 * renamed such that this breaks, rateLimit.ts silently falls back to
 * IP/anonymous keying with no failing test and no error — this test fails
 * loud instead.
 */
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIDDLEWARE_DIR = resolve(__dirname, "../../server/middleware");
const AUTH_FILE = "auth.ts";
const RATE_LIMIT_FILE = "rateLimit.ts";

describe("server/middleware ordering", () => {
  it("runs auth.ts before rateLimit.ts", () => {
    const files = readdirSync(MIDDLEWARE_DIR);

    expect(files).toContain(AUTH_FILE);
    expect(files).toContain(RATE_LIMIT_FILE);

    const sortedFiles = [...files].sort();
    const authIndex = sortedFiles.indexOf(AUTH_FILE);
    const rateLimitIndex = sortedFiles.indexOf(RATE_LIMIT_FILE);

    expect(
      authIndex,
      "auth.ts must sort before rateLimit.ts so event.context.userId is set by the time the rate limiter runs",
    ).toBeLessThan(rateLimitIndex);
  });
});
