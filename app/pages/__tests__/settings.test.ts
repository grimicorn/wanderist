import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, readonly } from "vue";
import { mount } from "@vue/test-utils";
import SettingsPage from "../settings.vue";

const defaultPreferencesData = {
  distanceUnit: "mi" as const,
  defaultMapStyle: "outdoors",
  publicProfile: true,
  preciseLocation: false,
  showOnExplore: true,
  displayName: "Dan H.",
  handle: "danh",
  homeBase: "St. Louis, USA",
  bio: "Chasing cold coffee and warm light.",
};

function makePreferencesMock(
  overrides: {
    savePreferences?: ReturnType<typeof vi.fn>;
    saveError?: string | null;
    loadError?: string | null;
    preferences?: typeof defaultPreferencesData;
  } = {},
) {
  return {
    preferences: ref(overrides.preferences ?? defaultPreferencesData),
    isLoading: readonly(ref(false)),
    loadError: readonly(ref(overrides.loadError ?? null)),
    saveError: readonly(ref(overrides.saveError ?? null)),
    fetchPreferences: vi.fn().mockResolvedValue(undefined),
    savePreferences:
      overrides.savePreferences ?? vi.fn().mockResolvedValue(true),
  };
}

vi.mock("~/composables/usePreferences", () => {
  const { ref: vueRef, readonly: vueReadonly } = require("vue");

  const defaultData = {
    distanceUnit: "mi",
    defaultMapStyle: "outdoors",
    publicProfile: true,
    preciseLocation: false,
    showOnExplore: true,
    displayName: "Dan H.",
    handle: "danh",
    homeBase: "St. Louis, USA",
    bio: "Chasing cold coffee and warm light.",
  };

  return {
    usePreferences: vi.fn(() => ({
      preferences: vueRef(defaultData),
      isLoading: vueReadonly(vueRef(false)),
      loadError: vueReadonly(vueRef(null)),
      saveError: vueReadonly(vueRef(null)),
      fetchPreferences: vi.fn().mockResolvedValue(undefined),
      savePreferences: vi.fn().mockResolvedValue(true),
    })),
    PREFERENCES_DEFAULTS: {
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
      displayName: null,
      handle: null,
      homeBase: null,
      bio: null,
    },
  };
});

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: vi.fn(() => ({
    apiFetch: vi.fn(),
  })),
}));

const iconStub = { template: "<svg data-icon />" };
const inputStub = {
  template: "<input />",
  props: [
    "modelValue",
    "label",
    "type",
    "placeholder",
    "state",
    "hint",
    "icon",
    "required",
  ],
};
const textareaStub = {
  template: "<textarea />",
  props: ["modelValue", "label", "placeholder", "rows"],
};
const alertStub = {
  template: '<div class="alert" />',
  props: ["intent", "title"],
};
const topbarStub = {
  template: '<header class="topbar"><slot /></header>',
  props: ["title", "crumb"],
};

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
      InputText: inputStub,
      InputTextarea: textareaStub,
      AppAlert: alertStub,
    },
  },
};

describe("Settings page (/settings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find(".set-layout").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the side navigation with all 6 sections", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".set-nav a")).toHaveLength(6);
  });

  it("renders all 6 settings sections", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".sect")).toHaveLength(6);
  });

  it("renders the 6 map style options", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".map-style")).toHaveLength(6);
  });

  it("toggles map style selection", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    const styles = wrapper.findAll(".map-style");
    await styles[1].trigger("click");
    expect(styles[1].classes()).toContain("is-active");
    expect(styles[0].classes()).not.toContain("is-active");
  });

  it("toggles unit selection", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    const buttons = wrapper.findAll(".segmented button");
    await buttons[1].trigger("click");
    expect(buttons[1].classes()).toContain("is-active");
    expect(buttons[0].classes()).not.toContain("is-active");
  });

  it("shows delete confirmation modal when delete button is clicked", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find(".modal-scrim").classes()).not.toContain("is-open");
    await wrapper.find(".danger .btn").trigger("click");
    expect(wrapper.find(".modal-scrim").classes()).toContain("is-open");
  });

  it("closes delete modal when cancel is clicked", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".danger .btn").trigger("click");
    await wrapper.find(".modal .btn--ghost").trigger("click");
    expect(wrapper.find(".modal-scrim").classes()).not.toContain("is-open");
  });

  it("shows saved toast after a successful save", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find(".saved-bar").classes()).not.toContain("show");
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".saved-bar").classes()).toContain("show");
  });

  it("save button calls savePreferences with the correct payload", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({ savePreferences: savePreferencesMock }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(savePreferencesMock).toHaveBeenCalledTimes(1);
    const payload = savePreferencesMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    // Verify key fields are sent; name comes from the mock ("Dan H.") which
    // is not null so should be sent as-is after nullableString trims it.
    expect(payload).toMatchObject({
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: true,
      preciseLocation: false,
      showOnExplore: true,
    });
  });

  it("does not call savePreferences when loadError is set", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({
        savePreferences: savePreferencesMock,
        loadError: "Failed to load preferences",
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();

    expect(savePreferencesMock).not.toHaveBeenCalled();
  });

  it("shows error toast (not success toast) when save fails", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(false);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({
        savePreferences: savePreferencesMock,
        saveError: null,
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    // The error bar has show class; the success bar is hidden via v-else
    const allSavedBars = wrapper.findAll(".saved-bar");
    expect(allSavedBars[0].classes()).toContain("show");
    // Only one bar is rendered at a time (v-if / v-else)
    expect(allSavedBars).toHaveLength(1);
  });
});
