import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import JournalPage from "../journal.vue";
import { pageGlobalConfig as globalConfig } from "./test-utils";

describe("Journal page (/journal)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.find(".feed").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders 3 feed tabs", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.findAll(".feed-tabs button")).toHaveLength(3);
    expect(wrapper.find(".feed-tabs button.is-active").text()).toBe("Timeline");
  });

  it("switches active tab when clicked", async () => {
    const wrapper = mount(JournalPage, globalConfig);
    const tabs = wrapper.findAll(".feed-tabs button");
    await tabs[1].trigger("click");
    expect(tabs[1].classes()).toContain("is-active");
    expect(tabs[0].classes()).not.toContain("is-active");
  });

  it("renders the compose bar", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.find(".compose").exists()).toBe(true);
    expect(wrapper.find(".compose input").exists()).toBe(true);
  });

  it("renders 2 day dividers", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.findAll(".day-div")).toHaveLength(2);
  });

  it("renders 2 posts", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.findAll(".post")).toHaveLength(2);
  });

  it("renders post titles", () => {
    const wrapper = mount(JournalPage, globalConfig);
    const titles = wrapper.findAll(".post__title").map((el) => el.text());
    expect(titles).toContain("Harbor at 4am");
    expect(titles).toContain("Tram 28, again");
  });

  it("post 1 starts with 24 likes and is not liked", () => {
    const wrapper = mount(JournalPage, globalConfig);
    const likeBtns = wrapper.findAll(".like");
    expect(likeBtns[0].find(".cnt").text()).toBe("24");
    expect(likeBtns[0].classes()).not.toContain("liked");
  });

  it("post 2 starts with 41 likes and is liked", () => {
    const wrapper = mount(JournalPage, globalConfig);
    const likeBtns = wrapper.findAll(".like");
    expect(likeBtns[1].find(".cnt").text()).toBe("41");
    expect(likeBtns[1].classes()).toContain("liked");
  });

  it("toggles like state and increments count on click", async () => {
    const wrapper = mount(JournalPage, globalConfig);
    const likeBtn = wrapper.findAll(".like")[0];
    await likeBtn.trigger("click");
    expect(likeBtn.classes()).toContain("liked");
    expect(likeBtn.find(".cnt").text()).toBe("25");
  });

  it("renders the right rail with active trip card", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.find(".rail").exists()).toBe(true);
    expect(wrapper.find(".rail-card .display").text()).toContain("Active trip");
  });

  it("renders 3 trip pills in the side rail", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.findAll(".trip-pill")).toHaveLength(3);
  });

  it("renders the on this day card", () => {
    const wrapper = mount(JournalPage, globalConfig);
    expect(wrapper.find(".onthisday").exists()).toBe(true);
    expect(wrapper.find(".onthisday .display").text()).toContain("On this day");
  });
});
