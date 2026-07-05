/**
 * Tests for GET /api/billing/config
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetPriceId } = vi.hoisted(() => ({
  mockGetPriceId: vi.fn(),
}));

vi.mock("../../../server/utils/stripe", () => ({
  getPriceId: mockGetPriceId,
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
});

const { default: handler } =
  await import("../../../server/api/billing/config.get");

type Handler = (event: unknown) => unknown;

function call(): unknown {
  return (handler as Handler)({});
}

describe("GET /api/billing/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports each tier/cycle as configured or not based on getPriceId, read fresh per call", () => {
    mockGetPriceId.mockImplementation((tier: string, cycle: string) =>
      tier === "wanderer" && cycle === "monthly"
        ? "price_wanderer_monthly"
        : null,
    );

    const result = call();

    expect(result).toEqual({
      wandererMonthlyConfigured: true,
      wandererYearlyConfigured: false,
      nomadMonthlyConfigured: false,
      nomadYearlyConfigured: false,
    });
  });

  it("reports all four as configured when every Price ID is set", () => {
    mockGetPriceId.mockReturnValue("price_some_id");

    const result = call();

    expect(result).toEqual({
      wandererMonthlyConfigured: true,
      wandererYearlyConfigured: true,
      nomadMonthlyConfigured: true,
      nomadYearlyConfigured: true,
    });
  });

  it("reports all four as unconfigured when no Price ID is set", () => {
    mockGetPriceId.mockReturnValue(null);

    const result = call();

    expect(result).toEqual({
      wandererMonthlyConfigured: false,
      wandererYearlyConfigured: false,
      nomadMonthlyConfigured: false,
      nomadYearlyConfigured: false,
    });
  });
});
