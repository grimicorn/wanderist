import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import AppCommandPalette from "../AppCommandPalette.vue";

const iconStub = { template: "<svg data-icon />" };
const linkStub = { template: "<a><slot /></a>", props: ["to"] };

// Reactive search state shared across tests
const mockQuery = ref("");
const mockResults = ref({ places: [], trips: [], entries: [], people: [] });
const mockIsLoading = ref(false);
const mockError = ref<string | null>(null);
const mockSearch = vi.fn();

vi.stubGlobal("useSearch", () => ({
  query: mockQuery,
  results: mockResults,
  isLoading: mockIsLoading,
  error: mockError,
  search: mockSearch,
}));

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      NuxtLink: linkStub,
    },
  },
};

describe("AppCommandPalette", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQuery.value = "";
    mockResults.value = { places: [], trips: [], entries: [], people: [] };
    mockIsLoading.value = false;
    mockError.value = null;
  });

  it("renders nothing when closed", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: false },
      ...globalConfig,
    });
    expect(wrapper.find(".cmdk").exists()).toBe(false);
  });

  it("renders the panel when open and matches snapshot", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".cmdk").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows only quick actions when query is empty", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    const labels = wrapper.findAll(".cmdk__glabel").map((el) => el.text());
    expect(labels).toEqual(["Quick actions"]);
  });

  it("shows 5 quick action items by default", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.findAll(".cmdk__item")).toHaveLength(5);
  });

  it("shows API search results when query is typed", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });

    // Simulate a search returning place results
    mockSearch.mockImplementation(() => {
      mockResults.value = {
        places: [
          {
            id: "p-1",
            title: "Reykjavík",
            subtitle: "Iceland",
            icon: "pin",
            href: "/map",
          },
        ],
        trips: [],
        entries: [],
        people: [],
      };
    });

    await wrapper.find(".cmdk__input").setValue("reyk");
    // Trigger the watch manually (watch fires synchronously in happy-dom)
    await wrapper.vm.$nextTick();

    expect(mockSearch).toHaveBeenCalledWith("reyk");
    expect(wrapper.findAll(".cmdk__item")).toHaveLength(1);
    expect(wrapper.find(".cmdk__t").text()).toContain("Reykjavík");
  });

  it("shows results from multiple groups when API returns results in several categories", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });

    // Simulate a search populating both places and trips
    mockSearch.mockImplementation(() => {
      mockResults.value = {
        places: [{ id: "p-1", title: "Reykjavík", icon: "pin", href: "/map" }],
        trips: [
          {
            id: "t-1",
            title: "Iceland trip",
            icon: "route",
            href: "/trips/t-1",
          },
        ],
        entries: [],
        people: [],
      };
    });

    await wrapper.find(".cmdk__input").setValue("ice");
    await flushPromises();
    await wrapper.vm.$nextTick();

    const labels = wrapper.findAll(".cmdk__glabel").map((el) => el.text());
    expect(labels).toContain("Places");
    expect(labels).toContain("Trips");
  });

  it("shows empty state when query is set but API returns no results", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });

    // mockSearch is vi.fn() (no-op after resetAllMocks), so mockResults stays empty.
    mockQuery.value = "zzznomatch";
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".cmdk__empty").exists()).toBe(true);
    expect(wrapper.find(".cmdk__empty").text()).toContain("zzznomatch");
  });

  it("emits close when scrim is clicked", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk__scrim").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("moves active index down on ArrowDown", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk").trigger("keydown", { key: "ArrowDown" });
    const items = wrapper.findAll(".cmdk__item");
    expect(items[1].classes()).toContain("is-active");
  });

  it("renders footer keyboard hints", () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".cmdk__foot").exists()).toBe(true);
    expect(wrapper.find(".cmdk__brand").text()).toBe("wanderist");
  });

  it("calls search when input value changes", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });

    await wrapper.find(".cmdk__input").setValue("tokyo");
    expect(mockSearch).toHaveBeenCalledWith("tokyo");
  });
});
