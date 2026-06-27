import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TripsPage from "../trips/index.vue";

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      NuxtLink: { template: "<a><slot /></a>", props: ["to"] },
    },
  },
};

describe("Trips page (/trips)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.find(".trips-head").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the featured active trip", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.find(".feature").exists()).toBe(true);
    expect(wrapper.html()).toContain("Iceland, the ring road");
  });

  it("renders 6 trips in the grid by default (All tab)", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.findAll(".tcard")).toHaveLength(6);
  });

  it("renders the tab filter", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.findAll(".seg-tabs button")).toHaveLength(4);
  });

  it("filters to upcoming trips when Upcoming tab is clicked", async () => {
    const wrapper = mount(TripsPage, globalConfig);
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[2].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(2);
  });

  it("filters to past trips when Past tab is clicked", async () => {
    const wrapper = mount(TripsPage, globalConfig);
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[3].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(4);
  });

  it("shows ongoing status badge on active trip", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.find(".tag--ongoing").exists()).toBe(true);
  });

  it("shows progress bar for active trip", () => {
    const wrapper = mount(TripsPage, globalConfig);
    expect(wrapper.find(".progress").exists()).toBe(true);
  });
});
