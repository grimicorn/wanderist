import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LoginPage from "../login.vue";

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: "<a><slot /></a>", props: ["to"] },
      SignIn: { template: '<div class="clerk-sign-in" />' },
    },
  },
};

describe("Login page (/login)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".auth").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the brand panel on the left", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".auth__brand").exists()).toBe(true);
    expect(wrapper.find(".brand-mid h1").text()).toContain("waiting");
  });

  it("renders the Clerk SignIn component on the right", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".clerk-sign-in").exists()).toBe(true);
  });

  it("renders floating map pins on the brand panel", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.findAll(".pin-float").length).toBeGreaterThan(0);
  });

  it("renders stats in the brand panel", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".stamp").exists()).toBe(true);
    expect(wrapper.html()).toContain("Reykjavík");
  });
});
