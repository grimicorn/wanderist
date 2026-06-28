import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import AppCommandPalette from "../AppCommandPalette.vue";
import { useTripsStore } from "~/stores/trips";
import type { Trip } from "~/stores/trips";

const SAMPLE_TRIPS: Trip[] = [
  {
    id: "t-1",
    userId: "u-1",
    name: "Iceland, the ring road",
    status: "ongoing",
    startDate: "2026-06-09T00:00:00.000Z",
    endDate: "2026-06-17T00:00:00.000Z",
    coverImageId: null,
    distanceKm: 892,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "t-2",
    userId: "u-1",
    name: "Portugal 2026",
    status: "upcoming",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "t-3",
    userId: "u-1",
    name: "Japan 2025",
    status: "past",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-11-01T00:00:00.000Z",
    updatedAt: "2025-11-01T00:00:00.000Z",
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

describe("AppCommandPalette", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const tripsStore = useTripsStore();
    tripsStore.tripList = [...SAMPLE_TRIPS];
  });

  it("renders nothing when closed", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: false },
      ...buildGlobalConfig(pinia),
    });
    expect(wrapper.find(".cmdk").exists()).toBe(false);
  });

  it("renders the panel when open and matches snapshot", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    expect(wrapper.find(".cmdk").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows only quick actions when query is empty", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    const labels = wrapper.findAll(".cmdk__glabel").map((el) => el.text());
    expect(labels).toEqual(["Quick actions"]);
  });

  it("shows 5 quick action items by default", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    expect(wrapper.findAll(".cmdk__item")).toHaveLength(5);
  });

  it("filters results when query is typed", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__input").setValue("reyk");
    expect(wrapper.findAll(".cmdk__item").length).toBeGreaterThan(0);
    expect(wrapper.html()).toContain("Reykjavík");
  });

  it("shows empty state when query has no matches", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__input").setValue("zzznomatch");
    expect(wrapper.find(".cmdk__empty").exists()).toBe(true);
    expect(wrapper.find(".cmdk__empty").text()).toContain("zzznomatch");
  });

  it("shows results from multiple groups when query matches across categories", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__input").setValue("re");
    const labels = wrapper.findAll(".cmdk__glabel").map((el) => el.text());
    expect(labels.length).toBeGreaterThan(1);
  });

  it("emits close when scrim is clicked", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__scrim").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("moves active index down on ArrowDown", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk").trigger("keydown", { key: "ArrowDown" });
    const items = wrapper.findAll(".cmdk__item");
    expect(items[1].classes()).toContain("is-active");
  });

  it("renders footer keyboard hints", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    expect(wrapper.find(".cmdk__foot").exists()).toBe(true);
    expect(wrapper.find(".cmdk__brand").text()).toBe("wanderist");
  });

  it("generates trip links using real trip ids from the store", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__input").setValue("iceland");
    // The NuxtLink stub renders as <a> but does not forward `to` as `href`.
    // Verify the item renders and that the underlying data routes to the correct id.
    const items = wrapper.findAll(".cmdk__item");
    const icelandItemText = items.find((item) =>
      item.text().includes("Iceland"),
    );
    expect(icelandItemText).toBeTruthy();
    // The NuxtLink stub renders `to` as `href`; verify the real trip id is used
    expect(wrapper.html()).toContain("/trips/t-1");
  });

  it("shows trip names from the store in search results", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...buildGlobalConfig(pinia),
    });
    await wrapper.find(".cmdk__input").setValue("portugal");
    // Highlight wraps the matched substring in <mark>; check text content instead
    const itemTexts = wrapper.findAll(".cmdk__item").map((item) => item.text());
    expect(itemTexts.some((text) => text.includes("Portugal 2026"))).toBe(true);
  });
});
