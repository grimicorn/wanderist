import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import PlanManageButton from "../PlanManageButton.vue";

describe("PlanManageButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
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

  it("renders slot content", () => {
    const wrapper = mount(PlanManageButton, {
      slots: { default: "manage subscription" },
    });

    expect(wrapper.text()).toContain("manage subscription");
  });

  it("navigates to /api/billing/portal on click", async () => {
    const wrapper = mount(PlanManageButton);

    await wrapper.find("button").trigger("click");

    expect(window.location.href).toBe("/api/billing/portal");
  });

  it("forwards attrs like class onto the rendered button", () => {
    const wrapper = mount(PlanManageButton, {
      attrs: { class: "btn btn--outline" },
    });
    expect(wrapper.find("button").classes()).toContain("btn--outline");
  });
});
