import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GuideDetailPage from "../guides/[id].vue";
import { useGuidesStore } from "~/stores/guides";
import type { Guide } from "~/stores/guides";

// Override the global useRoute stub to provide a guide id for these tests.
vi.stubGlobal("useRoute", () => ({ params: { id: "guide-1" }, query: {} }));

const SAMPLE_GUIDE: Guide = {
  id: "guide-1",
  userId: "user-1",
  title: "Tokyo on foot",
  body: "Start in Yanaka at sunrise.\n\nEnd at the river by dusk.",
  readTimeMinutes: 8,
  likeCount: 12,
  visibility: "public",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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

describe("Guide Detail page (/guides/[id])", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    const guidesStore = useGuidesStore();
    guidesStore.currentGuide = { ...SAMPLE_GUIDE };
    vi.spyOn(guidesStore, "fetchGuideById").mockResolvedValue();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".gdetail").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the guide title", () => {
    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".gdetail__head h1").text()).toBe("Tokyo on foot");
  });

  it("renders the guide body", () => {
    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".gdetail__body").text()).toContain(
      "Start in Yanaka at sunrise.",
    );
  });

  it("renders the read time", () => {
    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.text()).toContain("8 min read");
  });

  it("shows the not-found state when no guide is loaded", () => {
    const guidesStore = useGuidesStore();
    guidesStore.currentGuide = null;

    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.text()).toContain("Guide not found.");
  });

  it("shows a placeholder when the guide has no body", () => {
    const guidesStore = useGuidesStore();
    guidesStore.currentGuide = { ...SAMPLE_GUIDE, body: null };

    const wrapper = mount(GuideDetailPage, buildGlobalConfig(pinia));
    expect(wrapper.text()).toContain("This guide has no content yet.");
  });
});
