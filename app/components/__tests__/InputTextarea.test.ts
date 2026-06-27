import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InputTextarea from "../InputTextarea.vue";

const iconStub = { template: "<svg data-icon />" };

describe("InputTextarea", () => {
  it("renders a textarea", () => {
    const wrapper = mount(InputTextarea, {
      global: { stubs: { AppIcon: iconStub } },
    });
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("defaults to 4 rows", () => {
    const wrapper = mount(InputTextarea, {
      global: { stubs: { AppIcon: iconStub } },
    });
    expect(wrapper.find("textarea").attributes("rows")).toBe("4");
  });

  it("accepts a custom row count", () => {
    const wrapper = mount(InputTextarea, {
      props: { rows: 8 },
      global: { stubs: { AppIcon: iconStub } },
    });
    expect(wrapper.find("textarea").attributes("rows")).toBe("8");
  });

  it("emits update:modelValue on input", async () => {
    const wrapper = mount(InputTextarea, {
      props: { modelValue: "" },
      global: { stubs: { AppIcon: iconStub } },
    });
    await wrapper.find("textarea").setValue("journal entry");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      "journal entry",
    ]);
  });

  it("applies is-error class in error state", () => {
    const wrapper = mount(InputTextarea, {
      props: { state: "error" },
      global: { stubs: { AppIcon: iconStub } },
    });
    expect(wrapper.classes()).toContain("is-error");
  });

  it("renders label and links it to textarea", () => {
    const wrapper = mount(InputTextarea, {
      props: { label: "Notes" },
      global: { stubs: { AppIcon: iconStub } },
    });
    const labelFor = wrapper.find("label").attributes("for");
    const textareaId = wrapper.find("textarea").attributes("id");
    expect(labelFor).toBe(textareaId);
  });
});
