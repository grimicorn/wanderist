import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppImage from "../AppImage.vue";

describe("AppImage", () => {
  it("renders an <img> when a src URL is provided", () => {
    const wrapper = mount(AppImage, {
      props: {
        src: "https://example.com/photo.jpg",
        alt: "A photo",
      },
    });

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("https://example.com/photo.jpg");
    expect(img.attributes("alt")).toBe("A photo");
  });

  it("renders the placeholder when src is absent", () => {
    const wrapper = mount(AppImage, {
      props: { alt: "Placeholder" },
    });

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find(".ph").exists()).toBe(true);
    expect(wrapper.find(".topo").exists()).toBe(true);
  });

  it("renders the placeholder when src is null", () => {
    const wrapper = mount(AppImage, {
      props: { src: null },
    });

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find(".ph").exists()).toBe(true);
  });

  it("matches snapshot when src is provided", () => {
    const wrapper = mount(AppImage, {
      props: {
        src: "https://example.com/photo.jpg",
        alt: "Trip cover",
      },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot when src is absent (placeholder)", () => {
    const wrapper = mount(AppImage, {
      props: { alt: "No photo yet" },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });

  it("forwards extra class names to the root element", () => {
    const wrapper = mount(AppImage, {
      props: {
        src: "https://example.com/img.jpg",
        class: "my-custom-class",
      },
    });

    expect(wrapper.find(".my-custom-class").exists()).toBe(true);
  });

  it("placeholder forwards class names", () => {
    const wrapper = mount(AppImage, {
      props: { class: "trip-hero" },
    });

    expect(wrapper.find(".trip-hero").exists()).toBe(true);
  });
});
