import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppCommandPalette from "../AppCommandPalette.vue";

const iconStub = { template: "<svg data-icon />" };
const linkStub = { template: "<a><slot /></a>", props: ["to"] };

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      NuxtLink: linkStub,
    },
  },
};

describe("AppCommandPalette", () => {
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

  it("filters results when query is typed", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk__input").setValue("reyk");
    expect(wrapper.findAll(".cmdk__item").length).toBeGreaterThan(0);
    expect(wrapper.html()).toContain("Reykjavík");
  });

  it("shows empty state when query has no matches", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk__input").setValue("zzznomatch");
    expect(wrapper.find(".cmdk__empty").exists()).toBe(true);
    expect(wrapper.find(".cmdk__empty").text()).toContain("zzznomatch");
  });

  it("shows results from multiple groups when query matches across categories", async () => {
    const wrapper = mount(AppCommandPalette, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".cmdk__input").setValue("re");
    const labels = wrapper.findAll(".cmdk__glabel").map((el) => el.text());
    expect(labels.length).toBeGreaterThan(1);
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
});
