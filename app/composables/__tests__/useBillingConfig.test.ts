import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const mockApiFetch = vi.fn();

// useState must return the SAME ref across calls for a given key within a
// test, so the module-scoped dedup guard in useBillingConfig and the
// "shared across mounts" behavior can be exercised — unlike useBilling's
// test stub, which intentionally returns a fresh ref per call.
const stateByKey = new Map<string, ReturnType<typeof ref>>();
vi.stubGlobal("useState", (key: string, init: () => unknown) => {
  if (!stateByKey.has(key)) {
    stateByKey.set(key, ref(init()));
  }
  return stateByKey.get(key);
});

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: vi.fn(() => ({ apiFetch: mockApiFetch })),
}));

const { useBillingConfig } = await import("../useBillingConfig");

const SAMPLE_CONFIG = {
  wandererMonthlyConfigured: true,
  wandererYearlyConfigured: true,
  nomadMonthlyConfigured: false,
  nomadYearlyConfigured: false,
};

describe("useBillingConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateByKey.clear();
  });

  it("initializes with every tier/cycle unconfigured", () => {
    const { config } = useBillingConfig();
    expect(config.value).toEqual({
      wandererMonthlyConfigured: false,
      wandererYearlyConfigured: false,
      nomadMonthlyConfigured: false,
      nomadYearlyConfigured: false,
    });
  });

  it("calls GET /api/billing/config and updates config on success", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_CONFIG);

    const { fetchBillingConfig, config } = useBillingConfig();
    await fetchBillingConfig();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/billing/config");
    expect(config.value).toEqual(SAMPLE_CONFIG);
  });

  it("leaves the unconfigured default in place when the fetch fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("network error"));

    const { fetchBillingConfig, config } = useBillingConfig();
    await fetchBillingConfig();

    expect(config.value).toEqual({
      wandererMonthlyConfigured: false,
      wandererYearlyConfigured: false,
      nomadMonthlyConfigured: false,
      nomadYearlyConfigured: false,
    });
  });

  it("does not re-fetch once already loaded", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_CONFIG);

    const { fetchBillingConfig } = useBillingConfig();
    await fetchBillingConfig();
    await fetchBillingConfig();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent fetches from multiple simultaneously-mounted callers", async () => {
    let resolveFetch: (value: typeof SAMPLE_CONFIG) => void = () => {};
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = useBillingConfig();
    const second = useBillingConfig();

    const firstCall = first.fetchBillingConfig();
    const secondCall = second.fetchBillingConfig();

    resolveFetch(SAMPLE_CONFIG);
    await Promise.all([firstCall, secondCall]);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(second.config.value).toEqual(SAMPLE_CONFIG);
  });
});
