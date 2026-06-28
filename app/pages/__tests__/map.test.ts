import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MapPage from "../map.vue";
import { pageGlobalConfig as globalConfig } from "./test-utils";

// useApiClient is a Nuxt auto-import used by usePlacesStore. The mock is
// re-configured per test via mountWithPlaces so the onMounted fetch returns
// the same data we pre-load into the store.
const mockApiFetch = vi.fn().mockResolvedValue([]);
vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// defineStore is stubbed as vi.fn() in vitest.setup.ts for snapshot/component
// tests. Override it to the real pinia defineStore so the store actually works.
const { defineStore } = await import("pinia");
vi.stubGlobal("defineStore", defineStore);

const SAMPLE_PLACES = [
  {
    id: "p-1",
    userId: "u-1",
    name: "Reykjavík",
    subtitle: "Iceland · current trip",
    country: "Iceland",
    category: "city",
    latitude: 64.1355,
    longitude: -21.8954,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "p-2",
    userId: "u-1",
    name: "Tokyo",
    subtitle: "Japan · 2025",
    country: "Japan",
    category: "city",
    latitude: 35.6762,
    longitude: 139.6503,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "p-3",
    userId: "u-1",
    name: "Lisbon",
    subtitle: "Portugal",
    country: "Portugal",
    category: null,
    latitude: null,
    longitude: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

async function mountWithPlaces(places = SAMPLE_PLACES) {
  // Make apiFetch return the given places so onMounted's fetchPlaces() call
  // populates the store with the expected data rather than clobbering it with [].
  mockApiFetch.mockResolvedValue(places);

  const pinia = createPinia();
  setActivePinia(pinia);

  const wrapper = mount(MapPage, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      plugins: [pinia],
    },
  });

  // Drain the async onMounted queue so fetchPlaces() resolves and the store
  // is populated before assertions run.
  await flushPromises();

  return wrapper;
}

describe("Map page (/map)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue([]);
    setActivePinia(createPinia());
  });

  it("renders the map stage and matches snapshot", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".map-stage").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the places panel with store places", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.findAll(".place-item")).toHaveLength(SAMPLE_PLACES.length);
  });

  it("renders only pins for places with lat/lng coordinates", async () => {
    const wrapper = await mountWithPlaces();
    // Only Reykjavík and Tokyo have lat/lng; Lisbon does not.
    expect(wrapper.findAll(".pin-abs")).toHaveLength(2);
  });

  it("renders 4 filter chips", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.findAll(".chip")).toHaveLength(4);
  });

  it("activates filter chip when clicked", async () => {
    const wrapper = await mountWithPlaces();
    const chips = wrapper.findAll(".chip");
    await chips[1].trigger("click");
    expect(chips[1].classes()).toContain("is-active");
    expect(chips[0].classes()).not.toContain("is-active");
  });

  it("shows no detail card on initial load (no place pre-selected)", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".detail.is-open").exists()).toBe(false);
  });

  it("updates detail card when a place is selected", async () => {
    const wrapper = await mountWithPlaces();
    const items = wrapper.findAll(".place-item");
    await items[0].trigger("click");
    expect(wrapper.find(".detail__name").text()).toBe("Reykjavík");
  });

  it("closes detail card when close button is clicked", async () => {
    const wrapper = await mountWithPlaces();
    const items = wrapper.findAll(".place-item");
    await items[0].trigger("click");
    expect(wrapper.find(".detail.is-open").exists()).toBe(true);

    await wrapper.find(".detail__close").trigger("click");
    expect(wrapper.find(".detail.is-open").exists()).toBe(false);
  });

  it("renders 6 map style options", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.findAll(".lstyle")).toHaveLength(6);
  });

  it("defaults to outdoors map style", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".map-stage").attributes("data-mapstyle")).toBe(
      "outdoors",
    );
  });

  it("changes map style when a style is selected", async () => {
    const wrapper = await mountWithPlaces();
    const styles = wrapper.findAll(".lstyle");
    await styles[2].trigger("click");
    expect(wrapper.find(".map-stage").attributes("data-mapstyle")).toBe(
      "satellite",
    );
  });

  it("toggles the layers popover when button is clicked", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".layers-pop.is-open").exists()).toBe(false);
    await wrapper.find(".map-cbtn").trigger("click");
    expect(wrapper.find(".layers-pop.is-open").exists()).toBe(true);
  });

  it("closes the layers popover after selecting a style", async () => {
    const wrapper = await mountWithPlaces();
    await wrapper.find(".map-cbtn").trigger("click");
    await wrapper.findAll(".lstyle")[1].trigger("click");
    expect(wrapper.find(".layers-pop.is-open").exists()).toBe(false);
  });

  it("shows the legend with current style name and pin count from store", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".legend").text()).toContain("outdoors-v12");
    expect(wrapper.find(".legend").text()).toContain(
      `${SAMPLE_PLACES.length} pins`,
    );
  });

  it("filters place list when search is typed", async () => {
    const wrapper = await mountWithPlaces();
    const input = wrapper.find(".places__search input");
    await input.setValue("tokyo");
    expect(wrapper.findAll(".place-item")).toHaveLength(1);
    expect(wrapper.find(".place-item__name").text()).toBe("Tokyo");
  });

  it("shows the place count from store in the topbar tag", async () => {
    const wrapper = await mountWithPlaces();
    expect(wrapper.find(".tag.tag--accent").text()).toContain(
      `${SAMPLE_PLACES.length} places`,
    );
  });

  it("renders an empty list when store has no places", async () => {
    const wrapper = await mountWithPlaces([]);
    expect(wrapper.findAll(".place-item")).toHaveLength(0);
    expect(wrapper.findAll(".pin-abs")).toHaveLength(0);
    expect(wrapper.find(".legend").text()).toContain("0 pins");
  });
});
