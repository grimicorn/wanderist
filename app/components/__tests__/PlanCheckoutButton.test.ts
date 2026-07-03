import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import PlanCheckoutButton from "../PlanCheckoutButton.vue";

const checkoutButtonStub = vi.hoisted(() => ({
  name: "CheckoutButton",
  props: ["planId", "planPeriod", "newSubscriptionRedirectUrl"],
  template: '<div class="checkout-button-stub"><slot /></div>',
}));

vi.mock("@clerk/vue/experimental", () => ({
  CheckoutButton: checkoutButtonStub,
}));

let runtimeConfigMock = {
  public: { clerkPlanIdWanderer: "cplan_wanderer_123", clerkPlanIdNomad: "" },
};

vi.stubGlobal("useRuntimeConfig", () => runtimeConfigMock);

describe("PlanCheckoutButton", () => {
  beforeEach(() => {
    runtimeConfigMock = {
      public: {
        clerkPlanIdWanderer: "cplan_wanderer_123",
        clerkPlanIdNomad: "",
      },
    };
  });

  it("renders the Clerk CheckoutButton with the configured plan ID", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
      slots: { default: "free trial" },
    });

    const checkout = wrapper.findComponent(checkoutButtonStub);
    expect(checkout.exists()).toBe(true);
    expect(checkout.props("planId")).toBe("cplan_wanderer_123");
    expect(wrapper.text()).toContain("free trial");
  });

  it("maps 'monthly' to Clerk's 'month' period", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
    });
    expect(wrapper.findComponent(checkoutButtonStub).props("planPeriod")).toBe(
      "month",
    );
  });

  it("maps 'yearly' to Clerk's 'annual' period", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "yearly" },
    });
    expect(wrapper.findComponent(checkoutButtonStub).props("planPeriod")).toBe(
      "annual",
    );
  });

  it("passes redirectTo through as newSubscriptionRedirectUrl", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly", redirectTo: "/settings" },
    });
    expect(
      wrapper
        .findComponent(checkoutButtonStub)
        .props("newSubscriptionRedirectUrl"),
    ).toBe("/settings");
  });

  it("renders a disabled button instead of CheckoutButton when the plan ID is not configured", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "nomad", cycle: "monthly" },
      slots: { default: "free trial" },
    });

    expect(wrapper.findComponent(checkoutButtonStub).exists()).toBe(false);
    const button = wrapper.find("button");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.text()).toContain("free trial");
  });

  it("forwards attrs like class onto the rendered button", () => {
    const wrapper = mount(PlanCheckoutButton, {
      props: { tier: "wanderer", cycle: "monthly" },
      attrs: { class: "btn btn--primary" },
    });
    expect(wrapper.find("button").classes()).toContain("btn--primary");
  });
});
