import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import PlanCheckoutButton from "../PlanCheckoutButton.vue";

let runtimeConfigMock = {
  public: {
    stripeWandererMonthlyConfigured: true,
    stripeWandererYearlyConfigured: false,
    stripeNomadMonthlyConfigured: false,
    stripeNomadYearlyConfigured: false,
  },
};

vi.stubGlobal("useRuntimeConfig", () => runtimeConfigMock);

describe("PlanCheckoutButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    runtimeConfigMock = {
      public: {
        stripeWandererMonthlyConfigured: true,
        stripeWandererYearlyConfigured: false,
        stripeNomadMonthlyConfigured: false,
        stripeNomadYearlyConfigured: false,
      },
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
