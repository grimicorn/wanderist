import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TripsPage from "../trips/index.vue";
import { useTripsStore } from "~/stores/trips";
import type { Trip } from "~/stores/trips";

const SAMPLE_TRIPS: Trip[] = [
  {
    id: "1",
    userId: "user-1",
    name: "Iceland, the ring road",
    status: "ongoing",
    startDate: "2026-06-20T00:00:00.000Z",
    endDate: "2026-06-29T00:00:00.000Z",
    coverImageId: null,
    distanceKm: 892,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    userId: "user-1",
    name: "Portugal, coast to coast",
    status: "upcoming",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-10T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "3",
    userId: "user-1",
    name: "Norway in winter",
    status: "upcoming",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "4",
    userId: "user-1",
    name: "Japan, north to south",
    status: "past",
    startDate: "2025-10-04T00:00:00.000Z",
    endDate: "2025-10-22T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-10-22T00:00:00.000Z",
    updatedAt: "2025-10-22T00:00:00.000Z",
  },
  {
    id: "5",
    userId: "user-1",
    name: "Marrakech & the Atlas",
    status: "past",
    startDate: "2025-03-12T00:00:00.000Z",
    endDate: "2025-03-19T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-03-19T00:00:00.000Z",
    updatedAt: "2025-03-19T00:00:00.000Z",
  },
  {
    id: "6",
    userId: "user-1",
    name: "Sydney & the east coast",
    status: "past",
    startDate: "2024-11-02T00:00:00.000Z",
    endDate: "2024-11-16T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2024-11-16T00:00:00.000Z",
    updatedAt: "2024-11-16T00:00:00.000Z",
  },
];

function buildGlobalConfig(pinia: ReturnType<typeof createPinia>) {
  return {
    global: {
      plugins: [pinia],
      stubs: {
        AppIcon: { template: "<svg data-icon />" },
        NuxtLink: {
          template: '<a :href="to"><slot /></a>',
          props: ["to"],
        },
      },
    },
  };
}

describe("Trips page (/trips)", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    const tripsStore = useTripsStore();
    tripsStore.tripList = [...SAMPLE_TRIPS];
    vi.spyOn(tripsStore, "fetchTrips").mockResolvedValue();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".trips-head").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the featured active trip section", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".feature").exists()).toBe(true);
  });

  it("renders 6 trips in the grid by default (All tab)", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".tcard")).toHaveLength(6);
  });

  it("renders the tab filter", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".seg-tabs button")).toHaveLength(4);
  });

  it("filters to upcoming trips when Upcoming tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[2].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(2);
  });

  it("filters to past trips when Past tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[3].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(3);
  });

  it("filters to ongoing trips when Ongoing tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[1].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(1);
  });

  it("shows ongoing status badge on active trip card", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".tag--ongoing").exists()).toBe(true);
  });

  it("shows progress bar for active trip", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".progress").exists()).toBe(true);
  });

  it("shows trip names from the store", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.html()).toContain("Iceland, the ring road");
    expect(wrapper.html()).toContain("Portugal, coast to coast");
  });

  it("shows formatted dates when trip has start and end dates", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const cards = wrapper.findAll(".tcard__dates");
    // Trip 1 has dates so should not show "dates TBD"
    const tripWithDates = cards.find(
      (card) => !card.text().includes("dates TBD"),
    );
    expect(tripWithDates).toBeTruthy();
  });

  it("shows 'dates TBD' when trip has no start date", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.html()).toContain("dates TBD");
  });

  it("calls fetchTrips on mount", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tripsStore = useTripsStore();
    await wrapper.vm.$nextTick();
    expect(tripsStore.fetchTrips).toHaveBeenCalledTimes(1);
  });

  it("each trip card links to the correct trip detail route", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const cards = wrapper.findAll(".tcard");
    cards.forEach((card, index) => {
      const expectedId = SAMPLE_TRIPS[index].id;
      expect(card.attributes("href")).toBe(`/trips/${expectedId}`);
    });
  });
});
