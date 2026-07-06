import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import PlanCheckoutButton from "../PlanCheckoutButton.vue";

const mockFetchBillingConfig = vi.fn().mockResolvedValue(undefined);

let configRef = ref({
  wandererMonthlyConfigured: true,
  wandererYearlyConfigured: false,
  nomadMonthlyConfigured: false,
  nomadYearlyConfigured: false,
});

vi.mock("~/composables/useBillingConfig", () => ({
  useBillingConfig: () => ({
    config: configRef,
    fetchBillingConfig: mockFetchBillingConfig,
  }),
}));

describe("PlanCheckoutButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    configRef.value = {
      wandererMonthlyConfigured: true,
      wandererYearlyConfigured: false,
      nomadMonthlyConfigured: false,
      nomadYearlyConfigured: false,
    };
    // window.location.href is not settable via jsdom by default; stub it so
    // startCheckout's navigation can be observed without actually navigating.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders an enabled button for a configured tier/cycle", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
      slots: { default: "free trial" },
    });

    const button = wrapper.find("button");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).toContain("free trial");
  });

  it("renders a disabled button for an unconfigured tier/cycle", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "nomad", cycle: "monthly" },
      slots: { default: "free trial" },
    });

    const button = wrapper.find("button");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("title")).toBe("Checkout is not configured yet");
  });

  it("fetches billing config on mount", () => {
    mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
    });

    expect(mockFetchBillingConfig).toHaveBeenCalledTimes(1);
  });

  it("navigates to /api/billing/checkout with tier + cycle on click", async () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
    });

    await wrapper.find("button").trigger("click");

    expect(window.location.href).toBe(
      "/api/billing/checkout?tier=wanderer&cycle=monthly",
    );
  });

  it("includes redirectTo as a query param when provided", async () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly", redirectTo: "/settings" },
    });

    await wrapper.find("button").trigger("click");

    expect(window.location.href).toBe(
      "/api/billing/checkout?tier=wanderer&cycle=monthly&redirectTo=%2Fsettings",
    );
  });

  it("does not navigate when the button is disabled", async () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "nomad", cycle: "monthly" },
    });

    await wrapper.find("button").trigger("click");

    expect(window.location.href).toBe("");
  });

  it("forwards attrs like class onto the rendered button", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
      attrs: { class: "btn btn--primary" },
    });
    expect(wrapper.find("button").classes()).toContain("btn--primary");
  });
});
