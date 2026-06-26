import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import IndexPage from "../index.vue";
import AppIcon from "../../components/AppIcon.vue";
import AppThemeToggle from "../../components/AppThemeToggle.vue";

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: "<a><slot /></a>", props: ["to"] },
    },
  },
};

describe("Landing page (/)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("nav").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the hero section", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find(".lp-hero--a").exists()).toBe(true);
    expect(wrapper.find("h1").text()).toContain("living map");
  });

  it("renders all main sections", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("#features").exists()).toBe(true);
    expect(wrapper.find("#map").exists()).toBe(true);
    expect(wrapper.find("#how").exists()).toBe(true);
    expect(wrapper.find("#plans").exists()).toBe(true);
  });

  it("has three pricing tiers", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll(".tier")).toHaveLength(3);
  });

  it("has three testimonials", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll(".quote")).toHaveLength(3);
  });

  it("has email capture forms", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll('input[type="email"]').length).toBeGreaterThan(0);
  });

  it("renders the footer", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("footer.ftr").exists()).toBe(true);
  });
});
