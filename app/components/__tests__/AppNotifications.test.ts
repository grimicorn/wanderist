import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppNotifications from "../AppNotifications.vue";

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

describe("AppNotifications", () => {
  it("renders nothing when closed", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: false },
      ...globalConfig,
    });
    expect(wrapper.find(".notif").exists()).toBe(false);
  });

  it("renders the panel when open and matches snapshot", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders 6 notification items", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.findAll(".notif__item")).toHaveLength(6);
  });

  it("marks 3 notifications as unread by default", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.findAll(".notif__item.is-unread")).toHaveLength(3);
  });

  it("clears all unread when mark all read is clicked", async () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".notif__mark").trigger("click");
    expect(wrapper.findAll(".notif__item.is-unread")).toHaveLength(0);
  });

  it("renders the header with Notifications title", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif__head b").text()).toBe("Notifications");
  });

  it("renders the view all activity footer link", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif__foot").exists()).toBe(true);
    expect(wrapper.find(".notif__foot").text()).toContain("View all activity");
  });

  it("renders tone classes for each notification", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif__ico--info").exists()).toBe(true);
    expect(wrapper.find(".notif__ico--accent").exists()).toBe(true);
    expect(wrapper.find(".notif__ico--success").exists()).toBe(true);
    expect(wrapper.find(".notif__ico--warning").exists()).toBe(true);
  });
});
