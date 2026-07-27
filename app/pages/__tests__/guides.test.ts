import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GuidesPage from "../guides/index.vue";
import { useGuidesStore } from "~/stores/guides";
import type { Guide } from "~/stores/guides";

const SAMPLE_GUIDES: Guide[] = [
  {
    id: "g-1",
    userId: "user-1",
    title: "Tokyo on foot",
    body: "Start in Yanaka at sunrise.",
    readTimeMinutes: 8,
    likeCount: 12,
    visibility: "public",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "g-2",
    userId: "user-1",
    title: "Slow coastlines",
    body: null,
    readTimeMinutes: 5,
    likeCount: 0,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

// InputText/InputTextarea are resolved via Nuxt's components/ auto-import at
// build time, which plain Vitest can't do — stub them with a working
// v-model relay so setValue() interactions still reach GuideForm's refs.
const inputStub = {
  props: ["modelValue", "label", "placeholder", "required"],
  emits: ["update:modelValue"],
  template:
    '<input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
const textareaStub = {
  props: ["modelValue", "label", "placeholder", "rows"],
  emits: ["update:modelValue"],
  template:
    '<textarea :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
};

function buildGlobalConfig(pinia: ReturnType<typeof createPinia>) {
  return {
    global: {
      plugins: [pinia],
      stubs: {
        AppIcon: { template: "<svg data-icon />" },
        InputText: inputStub,
        InputTextarea: textareaStub,
      },
    },
  };
}

describe("Guides page (/guides)", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    const guidesStore = useGuidesStore();
    guidesStore.guides = [...SAMPLE_GUIDES];
    vi.spyOn(guidesStore, "fetchGuides").mockResolvedValue();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".guides-head").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("calls fetchGuides on mount", async () => {
    const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
    const guidesStore = useGuidesStore();
    await wrapper.vm.$nextTick();
    expect(guidesStore.fetchGuides).toHaveBeenCalledTimes(1);
  });

  it("renders a card for every guide", () => {
    const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".gcard")).toHaveLength(2);
  });

  it("shows the empty state when there are no guides", () => {
    const guidesStore = useGuidesStore();
    guidesStore.guides = [];
    const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".empty-note").exists()).toBe(true);
  });

  describe("new guide form", () => {
    it("shows the new guide form when the button is clicked", async () => {
      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      expect(wrapper.find(".guide-form").exists()).toBe(false);

      await wrapper.find(".guides-head button").trigger("click");

      expect(wrapper.find(".guide-form").exists()).toBe(true);
    });

    it("hides the form when cancel is clicked", async () => {
      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      await wrapper.find(".guides-head button").trigger("click");

      const cancelButton = wrapper
        .findAll(".guide-form button")
        .find((button) => button.text().includes("cancel"));
      await cancelButton?.trigger("click");

      expect(wrapper.find(".guide-form").exists()).toBe(false);
    });

    it("creates a guide with the entered title and closes the form", async () => {
      const guidesStore = useGuidesStore();
      const createdGuide: Guide = {
        ...SAMPLE_GUIDES[0],
        id: "g-new",
        title: "Patagonia loop",
      };
      vi.spyOn(guidesStore, "createGuide").mockResolvedValue(createdGuide);

      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      await wrapper.find(".guides-head button").trigger("click");
      await wrapper
        .find('input[placeholder="Guide title…"]')
        .setValue("Patagonia loop");
      await wrapper.find(".guide-form form").trigger("submit");
      await flushPromises();

      expect(guidesStore.createGuide).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Patagonia loop" }),
      );
      expect(wrapper.find(".guide-form").exists()).toBe(false);
    });

    it("shows an error message when guide creation fails", async () => {
      const guidesStore = useGuidesStore();
      vi.spyOn(guidesStore, "createGuide").mockRejectedValue(
        new Error("Failed to create guide"),
      );

      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      await wrapper.find(".guides-head button").trigger("click");
      await wrapper
        .find('input[placeholder="Guide title…"]')
        .setValue("Bad guide");
      await wrapper.find(".guide-form form").trigger("submit");
      await flushPromises();

      expect(wrapper.find(".guide-form__error").text()).toBe(
        "Failed to create guide",
      );
      expect(wrapper.find(".guide-form").exists()).toBe(true);
    });
  });

  describe("editing a guide", () => {
    it("shows an inline edit form pre-filled with the guide's fields", async () => {
      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      const editButtons = wrapper
        .findAll(".gcard__acts button")
        .filter((button) => button.text() === "edit");

      await editButtons[0].trigger("click");

      const titleInput = wrapper.find(
        'input[placeholder="Guide title…"]',
      ) as unknown as { element: HTMLInputElement };
      expect(titleInput.element.value).toBe("Tokyo on foot");
    });

    it("updates the guide and closes the edit form", async () => {
      const guidesStore = useGuidesStore();
      const updatedGuide: Guide = {
        ...SAMPLE_GUIDES[0],
        title: "Tokyo on foot, revised",
      };
      vi.spyOn(guidesStore, "updateGuide").mockResolvedValue(updatedGuide);

      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      const editButtons = wrapper
        .findAll(".gcard__acts button")
        .filter((button) => button.text() === "edit");
      await editButtons[0].trigger("click");

      await wrapper
        .find('input[placeholder="Guide title…"]')
        .setValue("Tokyo on foot, revised");
      await wrapper.find(".guide-form form").trigger("submit");
      await flushPromises();

      expect(guidesStore.updateGuide).toHaveBeenCalledWith(
        "g-1",
        expect.objectContaining({ title: "Tokyo on foot, revised" }),
      );
      expect(wrapper.find(".guide-form").exists()).toBe(false);
    });
  });

  describe("deleting a guide", () => {
    it("calls deleteGuide with the guide's id", async () => {
      const guidesStore = useGuidesStore();
      vi.spyOn(guidesStore, "deleteGuide").mockResolvedValue();

      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      const deleteButtons = wrapper
        .findAll(".gcard__acts button")
        .filter((button) => button.text().includes("delete"));
      await deleteButtons[0].trigger("click");
      await flushPromises();

      expect(guidesStore.deleteGuide).toHaveBeenCalledWith("g-1");
    });

    it("shows an error message when deletion fails", async () => {
      const guidesStore = useGuidesStore();
      vi.spyOn(guidesStore, "deleteGuide").mockRejectedValue(
        new Error("Failed to delete guide"),
      );

      const wrapper = mount(GuidesPage, buildGlobalConfig(pinia));
      const deleteButtons = wrapper
        .findAll(".gcard__acts button")
        .filter((button) => button.text().includes("delete"));
      await deleteButtons[0].trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Failed to delete guide");
    });
  });
});
