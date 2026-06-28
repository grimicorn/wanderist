import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import HomePage from "../home.vue";
import { pageGlobalConfig as globalConfig } from "./test-utils";

const mockFetchStats = vi.fn().mockResolvedValue(undefined);
const mockStatsRef = ref({
  placesCount: 117,
  countriesCount: 9,
  totalDistanceMi: 48218,
  totalDistanceKm: 77600,
  currentStreak: 14,
  placesThisWeek: 6,
  distanceMiThisWeek: 1400,
  distanceKmThisWeek: 2254,
  distanceUnit: "mi",
});

vi.mock("~/composables/useStats", () => ({
  useStats: vi.fn(() => ({
    stats: mockStatsRef,
    isLoading: ref(false),
    loadError: ref(null),
    fetchStats: mockFetchStats,
  })),
}));

describe("Home / Dashboard page (/home)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".hello").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the greeting section", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".hello h1").text()).toContain("Welcome back");
    expect(wrapper.find(".hello h1 b").text()).toBe("Dan.");
  });

  it("renders 4 stat cards", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.findAll(".stat")).toHaveLength(4);
  });

  it("renders stat values from useStats composable", () => {
    const wrapper = mount(HomePage, globalConfig);
    const nums = wrapper.findAll(".stat__num").map((el) => el.text());
    // Values are derived from the mocked useStats (117 places, 9 countries,
    // 48218 mi → "48.2k", 14 streak).
    expect(nums).toContain("117");
    expect(nums).toContain("9");
    expect(nums).toContain("48.2k");
    expect(nums).toContain("14");
  });

  it("renders the import alert", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".alert--info").exists()).toBe(true);
    expect(wrapper.find(".alert__title").text()).toContain("geotagged photos");
  });

  it("renders the mini map card with 6 pins", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".map-card").exists()).toBe(true);
    expect(wrapper.findAll(".pin-abs")).toHaveLength(6);
  });

  it("renders the current trip card", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".trip-card").exists()).toBe(true);
    expect(wrapper.find(".trip-card h3").text()).toBe("Iceland, the ring road");
  });

  it("renders the progress bar", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".progress").exists()).toBe(true);
    expect(wrapper.find(".progress span").attributes("style")).toContain(
      "width:64%",
    );
  });

  it("renders the next stop in the trip card", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.find(".nextstop").exists()).toBe(true);
    expect(wrapper.find(".nextstop").text()).toContain("Jökulsárlón");
  });

  it("renders 2 recent journal entries", () => {
    const wrapper = mount(HomePage, globalConfig);
    expect(wrapper.findAll(".entry")).toHaveLength(2);
  });

  it("renders entry titles", () => {
    const wrapper = mount(HomePage, globalConfig);
    const titles = wrapper.findAll(".entry__title").map((el) => el.text());
    expect(titles).toContain("Harbor at 4am");
    expect(titles).toContain("Tram 28, again");
  });
});
