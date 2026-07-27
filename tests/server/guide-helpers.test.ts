/**
 * Unit tests for server/utils/guide-helpers.ts
 */
import { describe, it, expect, vi } from "vitest";

const mockCreateError = vi.fn(
  (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
);

Object.assign(globalThis, {
  createError: mockCreateError,
});

const {
  parseReadTimeMinutes,
  parseOptionalGuideBody,
  MIN_READ_TIME_MINUTES,
  MAX_READ_TIME_MINUTES,
} = await import("../../server/utils/guide-helpers");

describe("parseReadTimeMinutes", () => {
  it("returns undefined when the value is absent", () => {
    expect(parseReadTimeMinutes(undefined)).toBeUndefined();
  });

  it("returns the value when it is a valid integer at the floor", () => {
    expect(parseReadTimeMinutes(MIN_READ_TIME_MINUTES)).toBe(
      MIN_READ_TIME_MINUTES,
    );
  });

  it("returns the value when it is a valid integer above the floor", () => {
    expect(parseReadTimeMinutes(8)).toBe(8);
  });

  it("throws 400 when the value is below the floor", () => {
    expect(() => parseReadTimeMinutes(0)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("returns the value when it is a valid integer at the ceiling", () => {
    expect(parseReadTimeMinutes(MAX_READ_TIME_MINUTES)).toBe(
      MAX_READ_TIME_MINUTES,
    );
  });

  it("throws 400 when the value is above the ceiling", () => {
    expect(() => parseReadTimeMinutes(MAX_READ_TIME_MINUTES + 1)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for a wildly out-of-range value that would overflow a Postgres int4", () => {
    expect(() => parseReadTimeMinutes(3000000000)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is not an integer", () => {
    expect(() => parseReadTimeMinutes(3.5)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is explicitly null", () => {
    // parseOptionalInt returns `null` for `null` — this column is NOT NULL,
    // so null must be rejected rather than silently reaching the database.
    expect(() => parseReadTimeMinutes(null)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is negative", () => {
    expect(() => parseReadTimeMinutes(-3)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("parseOptionalGuideBody", () => {
  it("returns undefined when the value is absent", () => {
    expect(parseOptionalGuideBody(undefined)).toBeUndefined();
  });

  it("returns undefined when the value is explicitly null", () => {
    expect(parseOptionalGuideBody(null)).toBeUndefined();
  });

  it("returns null for an empty string", () => {
    expect(parseOptionalGuideBody("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseOptionalGuideBody("   ")).toBeNull();
  });

  it("returns the trimmed string for a non-blank value", () => {
    expect(parseOptionalGuideBody(" Start at the north jetty. ")).toBe(
      "Start at the north jetty.",
    );
  });

  it("throws 400 when the value is not a string", () => {
    expect(() => parseOptionalGuideBody(42)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});
