/**
 * Unit tests for server/utils/validation.ts
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
  parseEnum,
  parseOptionalEnum,
  parseDate,
  parseOptionalDate,
  parseOptionalInt,
  parseOptionalFloat,
} = await import("../../server/utils/validation");

describe("parseEnum", () => {
  const ALLOWED = ["a", "b", "c"] as const;

  it("returns the value when valid", () => {
    expect(parseEnum("b", ALLOWED, "field", "a")).toBe("b");
  });

  it("returns the default when value is undefined", () => {
    expect(parseEnum(undefined, ALLOWED, "field", "a")).toBe("a");
  });

  it("returns the default when value is null", () => {
    expect(parseEnum(null, ALLOWED, "field", "a")).toBe("a");
  });

  it("throws 400 for an invalid value", () => {
    expect(() => parseEnum("z", ALLOWED, "field", "a")).toThrow();
    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("parseOptionalEnum", () => {
  const ALLOWED = ["x", "y"] as const;

  it("returns the value when valid", () => {
    expect(parseOptionalEnum("x", ALLOWED, "field")).toBe("x");
  });

  it("returns undefined when absent", () => {
    expect(parseOptionalEnum(undefined, ALLOWED, "field")).toBeUndefined();
    expect(parseOptionalEnum(null, ALLOWED, "field")).toBeUndefined();
  });

  it("throws 400 for an invalid value", () => {
    expect(() => parseOptionalEnum("z", ALLOWED, "field")).toThrow();
  });
});

describe("parseDate", () => {
  it("returns a Date for a valid ISO string", () => {
    const result = parseDate("2026-06-01T00:00:00.000Z", "startDate");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("throws 400 when the value is missing", () => {
    expect(() => parseDate(undefined, "startDate")).toThrow();
    expect(() => parseDate(null, "startDate")).toThrow();
  });

  it("throws 400 when the value is not a string", () => {
    expect(() => parseDate(42, "startDate")).toThrow();
  });

  it("throws 400 for an invalid date string", () => {
    expect(() => parseDate("not-a-date", "startDate")).toThrow();
  });
});

describe("parseOptionalDate", () => {
  it("returns a Date for a valid ISO string", () => {
    const result = parseOptionalDate("2026-07-10T00:00:00.000Z", "endDate");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns undefined when the value is absent", () => {
    expect(parseOptionalDate(undefined, "endDate")).toBeUndefined();
  });

  it("returns null when the value is null (clears the field)", () => {
    expect(parseOptionalDate(null, "endDate")).toBeNull();
  });

  it("throws 400 for an invalid date string", () => {
    expect(() => parseOptionalDate("bad", "endDate")).toThrow();
  });

  it("throws 400 when the value is a non-string non-null type", () => {
    expect(() => parseOptionalDate(123, "endDate")).toThrow();
  });
});

describe("parseOptionalInt", () => {
  it("returns the integer when valid", () => {
    expect(parseOptionalInt(5, "nights")).toBe(5);
    expect(parseOptionalInt(0, "nights")).toBe(0);
  });

  it("returns undefined when absent", () => {
    expect(parseOptionalInt(undefined, "nights")).toBeUndefined();
  });

  it("returns null when value is null", () => {
    expect(parseOptionalInt(null, "nights")).toBeNull();
  });

  it("throws 400 for a float", () => {
    expect(() => parseOptionalInt(1.5, "nights")).toThrow();
  });

  it("throws 400 for a negative integer", () => {
    expect(() => parseOptionalInt(-1, "nights")).toThrow();
  });

  it("throws 400 for a non-number", () => {
    expect(() => parseOptionalInt("2", "nights")).toThrow();
  });
});

describe("parseOptionalFloat", () => {
  it("returns the number when valid", () => {
    expect(parseOptionalFloat(12.5, "distanceKm")).toBe(12.5);
    expect(parseOptionalFloat(0, "distanceKm")).toBe(0);
  });

  it("returns undefined when absent", () => {
    expect(parseOptionalFloat(undefined, "distanceKm")).toBeUndefined();
  });

  it("returns null when value is null", () => {
    expect(parseOptionalFloat(null, "distanceKm")).toBeNull();
  });

  it("throws 400 for NaN", () => {
    expect(() => parseOptionalFloat(NaN, "distanceKm")).toThrow();
  });

  it("throws 400 for a non-number", () => {
    expect(() => parseOptionalFloat("5", "distanceKm")).toThrow();
  });

  it("throws 400 for Infinity", () => {
    expect(() => parseOptionalFloat(Infinity, "distanceKm")).toThrow();
    expect(() => parseOptionalFloat(-Infinity, "distanceKm")).toThrow();
  });

  it("throws 400 for a negative number", () => {
    expect(() => parseOptionalFloat(-1, "distanceKm")).toThrow();
  });
});
