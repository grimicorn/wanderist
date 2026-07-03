import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PlanManageButton from "../PlanManageButton.vue";

const subscriptionDetailsButtonStub = vi.hoisted(() => ({
  name: "SubscriptionDetailsButton",
  template: '<div class="subscription-details-button-stub"><slot /></div>',
}));

vi.mock("@clerk/vue/experimental", () => ({
  SubscriptionDetailsButton: subscriptionDetailsButtonStub,
}));

describe("PlanManageButton", () => {
  it("renders the Clerk SubscriptionDetailsButton with slot content", () => {
    const wrapper = mount(PlanManageButton, {
      slots: { default: "manage subscription" },
    });

    expect(wrapper.findComponent(subscriptionDetailsButtonStub).exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("manage subscription");
  });

  it("forwards attrs like class onto the rendered button", () => {
    const wrapper = mount(PlanManageButton, {
      attrs: { class: "btn btn--outline" },
    });
    expect(wrapper.find("button").classes()).toContain("btn--outline");
  });
});
