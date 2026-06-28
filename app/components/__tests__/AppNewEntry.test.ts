import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import AppNewEntry from "../AppNewEntry.vue";

const iconStub = { template: "<svg data-icon />" };

// ── Store stubs ────────────────────────────────────────────────────────────────

const mockCreateEntry = vi.fn();
const mockFetchEntries = vi.fn();
const mockFetchTrips = vi.fn();
const mockFetchPlaces = vi.fn();

const tripsStoreTrips = ref<
  Array<{ id: string; name: string; status: string }>
>([]);
const placesStorePlaces = ref<Array<{ id: string; name: string }>>([]);

vi.stubGlobal("useEntriesStore", () => ({
  createEntry: mockCreateEntry,
  fetchEntries: mockFetchEntries,
  entries: ref([]),
  isLoading: ref(false),
  error: ref(null),
}));

vi.stubGlobal("useTripsStore", () => ({
  tripList: tripsStoreTrips.value,
  fetchTrips: mockFetchTrips,
  isLoadingList: ref(false),
}));

vi.stubGlobal("usePlacesStore", () => ({
  places: placesStorePlaces.value,
  fetchPlaces: mockFetchPlaces,
  isLoading: ref(false),
}));

const mockUpload = vi.fn();
vi.stubGlobal("useMediaUpload", () => ({
  upload: mockUpload,
  isUploading: ref(false),
  error: ref(null),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
    },
  },
};

function mountOpen() {
  return mount(AppNewEntry, {
    props: { open: true },
    ...globalConfig,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AppNewEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tripsStoreTrips.value = [];
    placesStorePlaces.value = [];
  });

  it("renders nothing when closed", () => {
    const wrapper = mount(AppNewEntry, {
      props: { open: false },
      ...globalConfig,
    });
    expect(wrapper.find(".drawer").exists()).toBe(false);
  });

  it("renders the drawer when open and matches snapshot", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".drawer").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the drawer header with correct title", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".drawer__head h3").text()).toBe("Capture a moment");
  });

  it("emits close when scrim is clicked", async () => {
    const wrapper = mountOpen();
    await wrapper.find(".drawer__scrim").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mountOpen();
    await wrapper.find(".drawer__head .icon-btn").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close when cancel button is clicked", async () => {
    const wrapper = mountOpen();
    await wrapper.find(".btn--outline").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("renders the photo dropzone with add button", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".dropzone").exists()).toBe(true);
    expect(wrapper.find(".dz-add").exists()).toBe(true);
  });

  it("shows 'add photos' label on the dropzone button", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".dz-add span").text()).toBe("add photos");
  });

  it("renders 3 weather options", () => {
    const wrapper = mountOpen();
    const weatherSection = wrapper.findAll(".pill-pick").at(-1);
    expect(weatherSection?.findAll(".pick")).toHaveLength(3);
  });

  it("renders visibility toggle with Private and Public options", () => {
    const wrapper = mountOpen();
    const buttons = wrapper.find(".segmented").findAll("button");
    expect(buttons[0].text()).toBe("Private");
    expect(buttons[1].text()).toBe("Public");
    expect(buttons[0].classes()).toContain("is-active");
  });

  it("switches visibility when Public is clicked", async () => {
    const wrapper = mountOpen();
    const buttons = wrapper.find(".segmented").findAll("button");
    await buttons[1].trigger("click");
    expect(buttons[1].classes()).toContain("is-active");
    expect(buttons[0].classes()).not.toContain("is-active");
  });

  it("starts with no tags by default", () => {
    const wrapper = mountOpen();
    expect(wrapper.findAll(".tag.tag--accent")).toHaveLength(0);
  });

  it("adds a tag when enter is pressed in the tag input", async () => {
    const wrapper = mountOpen();
    const tagInput = wrapper.find(".tags-input input");
    await tagInput.setValue("adventure");
    await tagInput.trigger("keydown.enter");
    expect(wrapper.find(".tags-input").text()).toContain("adventure");
  });

  it("removes a tag when its remove button is clicked", async () => {
    const wrapper = mountOpen();
    // Add a tag first
    const tagInput = wrapper.find(".tags-input input");
    await tagInput.setValue("iceland");
    await tagInput.trigger("keydown.enter");
    const removeButtons = wrapper.findAll(".tag-x");
    await removeButtons[0].trigger("click");
    expect(wrapper.find(".tags-input").text()).not.toContain("iceland");
  });

  it("renders a None trip option when trips store is empty", () => {
    const wrapper = mountOpen();
    const tripPicks = wrapper.find(".pill-pick");
    expect(tripPicks.text()).toContain("None");
  });

  it("renders trip options from the trips store", () => {
    tripsStoreTrips.value = [
      { id: "trip-1", name: "Iceland Ring Road", status: "ongoing" },
      { id: "trip-2", name: "Portugal 2026", status: "past" },
    ];
    const wrapper = mountOpen();
    const picks = wrapper.find(".pill-pick").findAll(".pick");
    const labels = picks.map((pick) => pick.text());
    expect(labels).toContain("Iceland Ring Road");
    expect(labels).toContain("Portugal 2026");
    expect(labels).toContain("None");
  });

  it("defaults to the ongoing trip when trips are available", () => {
    tripsStoreTrips.value = [
      { id: "trip-1", name: "Iceland Ring Road", status: "ongoing" },
      { id: "trip-2", name: "Portugal 2026", status: "past" },
    ];
    const wrapper = mountOpen();
    const activePick = wrapper.find(".pill-pick .pick.is-active");
    expect(activePick.text()).toBe("Iceland Ring Road");
  });

  it("renders location suggestion chips from the places store", () => {
    placesStorePlaces.value = [
      { id: "p-1", name: "Old Harbour" },
      { id: "p-2", name: "Hallgrímskirkja" },
    ];
    const wrapper = mountOpen();
    expect(wrapper.find(".chip-suggest").exists()).toBe(true);
    expect(wrapper.findAll(".chip")).toHaveLength(2);
  });

  it("hides location chip suggestions when places store is empty", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".chip-suggest").exists()).toBe(false);
  });

  it("updates location when a suggestion chip is clicked", async () => {
    placesStorePlaces.value = [
      { id: "p-1", name: "Old Harbour" },
      { id: "p-2", name: "Hallgrímskirkja" },
    ];
    const wrapper = mountOpen();
    const chips = wrapper.findAll(".chip");
    await chips[0].trigger("click");
    const locationField = wrapper
      .find(".chip-suggest")
      .element.closest(".field");
    const locationInput = locationField?.querySelector(
      ".field__input",
    ) as HTMLInputElement | null;
    expect(locationInput?.value).toBe("Old Harbour");
  });

  it("renders publish and save draft buttons in footer", () => {
    const wrapper = mountOpen();
    expect(wrapper.find(".drawer__foot .btn--primary").text()).toContain(
      "publish",
    );
    expect(wrapper.find(".drawer__foot .btn--ghost").text()).toContain(
      "save draft",
    );
  });

  it("calls createEntry and emits close on publish", async () => {
    mockCreateEntry.mockResolvedValue({ id: "new-entry-1" });
    mockFetchEntries.mockResolvedValue({
      entries: [],
      tab: "timeline",
      page: 1,
    });

    const wrapper = mountOpen();
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(mockCreateEntry).toHaveBeenCalledOnce();
    expect(mockFetchEntries).toHaveBeenCalledOnce();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows publish error when createEntry throws", async () => {
    mockCreateEntry.mockRejectedValue(new Error("Server error"));

    const wrapper = mountOpen();
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".error-hint").text()).toContain("Server error");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("saves draft to localStorage when save draft is clicked", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const wrapper = mountOpen();
    await wrapper.find(".btn--ghost").trigger("click");
    expect(setItemSpy).toHaveBeenCalledWith(
      "wanderist:new-entry-draft",
      expect.any(String),
    );
    setItemSpy.mockRestore();
  });
});
