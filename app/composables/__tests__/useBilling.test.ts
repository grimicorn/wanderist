import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const mockApiFetch = vi.fn();

vi.stubGlobal("useState", (_key: string, init: () => unknown) => {
  return ref(init());
});

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: vi.fn(() => ({ apiFetch: mockApiFetch })),
}));

const { useBilling } = await import("../useBilling");

const SAMPLE_SUBSCRIPTION = {
  plan: "wanderer" as const,
  status: "active" as const,
  billingCycle: "monthly" as const,
  trialEndsAt: null,
  currentPeriodEnd: "2026-08-01T00:00:00.000Z",
};

describe("useBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with the free Drifter plan as the default", () => {
    const { subscription } = useBilling();
    expect(subscription.value).toEqual({
      plan: "drifter",
      status: "active",
      billingCycle: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
  });

  describe("fetchSubscription", () => {
    it("sets subscription on success", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_SUBSCRIPTION);

      const { fetchSubscription, subscription } = useBilling();
      await fetchSubscription();

      expect(subscription.value).toEqual(SAMPLE_SUBSCRIPTION);
    });

    it("calls /api/billing/subscription", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_SUBSCRIPTION);

      const { fetchSubscription } = useBilling();
      await fetchSubscription();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/billing/subscription");
    });

    it("resets to the free plan and sets loadError on failure", async () => {
      mockApiFetch.mockResolvedValueOnce(SAMPLE_SUBSCRIPTION);
      const { fetchSubscription, subscription, loadError } = useBilling();
      await fetchSubscription();
      expect(subscription.value.plan).toBe("wanderer");

      const serverError = Object.assign(new Error("[GET] 500"), {
        data: { statusMessage: "Could not load subscription" },
      });
      mockApiFetch.mockRejectedValue(serverError);
      await fetchSubscription();

      expect(subscription.value.plan).toBe("drifter");
      expect(loadError.value).toBe("Could not load subscription");
    });

    it("falls back to a generic message when the error has no recognizable shape", async () => {
      mockApiFetch.mockRejectedValue("plain string error");

      const { fetchSubscription, loadError } = useBilling();
      await fetchSubscription();

      expect(loadError.value).toBe("An unexpected error occurred");
    });

    it("exposes isLoading as readonly", () => {
      const { isLoading } = useBilling();
      expect(typeof isLoading.value).toBe("boolean");
    });

    it("exposes loadError as readonly and initially null", () => {
      const { loadError } = useBilling();
      expect(loadError.value).toBeNull();
    });
  });
});
