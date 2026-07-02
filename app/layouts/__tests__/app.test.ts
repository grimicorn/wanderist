import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, inject } from "vue";
import AppLayout from "../app.vue";
import { useCommandPaletteShortcut } from "../../composables/useCommandPaletteShortcut";

// app.vue calls useCommandPaletteShortcut bare, relying on Nuxt's
// auto-import; plain Vitest has no auto-import, so it must be exposed as a
// global the same way vitest.setup.ts exposes useClerkAuth, useSearch, etc.
// The real implementation is used (not a mock) so these tests exercise the
// actual shortcut wiring.
vi.stubGlobal("useCommandPaletteShortcut", useCommandPaletteShortcut);

// Heavy children (real Clerk/store/composable usage) are stubbed with simple
// open/close mirrors so these tests exercise the layout's own wiring —
// mounting the command palette, providing openCommandPalette, and the
// global ⌘K/Ctrl+K shortcut — without depending on their internals.
const sidebarStub = defineComponent({
  name: "AppSidebarStub",
  props: ["isOpen"],
  emits: ["close"],
  template: '<div class="sidebar-stub" :data-open="isOpen" />',
});

const newEntryStub = defineComponent({
  name: "AppNewEntryStub",
  props: ["open"],
  emits: ["close"],
  template: '<div class="new-entry-stub" :data-open="open" />',
});

const notificationsStub = defineComponent({
  name: "AppNotificationsStub",
  props: ["open"],
  emits: ["close"],
  template: '<div class="notifications-stub" :data-open="open" />',
});

const commandPaletteStub = defineComponent({
  name: "AppCommandPaletteStub",
  props: ["open"],
  emits: ["close"],
  template: '<div class="command-palette-stub" :data-open="open" />',
});

// Stands in for a real page (home.vue, explore.vue) that injects
// openCommandPalette to wire its topbar search button.
const triggerHost = defineComponent({
  name: "TriggerHost",
  setup() {
    const openCommandPalette = inject<(() => void) | undefined>(
      "openCommandPalette",
      undefined,
    );
    return () =>
      h(
        "button",
        { class: "trigger", onClick: () => openCommandPalette?.() },
        "open",
      );
  },
});

function mountLayout() {
  return mount(AppLayout, {
    slots: { default: () => h(triggerHost) },
    global: {
      stubs: {
        AppSidebar: sidebarStub,
        AppNewEntry: newEntryStub,
        AppNotifications: notificationsStub,
        AppCommandPalette: commandPaletteStub,
      },
    },
  });
}

describe("layouts/app.vue", () => {
  it("mounts the command palette closed by default", () => {
    const wrapper = mountLayout();
    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "false",
    );
  });

  it("opens the command palette when a descendant calls the injected openCommandPalette", async () => {
    const wrapper = mountLayout();

    await wrapper.find(".trigger").trigger("click");

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "true",
    );
  });

  it("opens the command palette on the global ⌘K/Ctrl+K shortcut", async () => {
    const wrapper = mountLayout();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "true",
    );
  });

  it("closes the command palette when it emits close", async () => {
    const wrapper = mountLayout();
    await wrapper.find(".trigger").trigger("click");

    await wrapper.findComponent(commandPaletteStub).vm.$emit("close");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "false",
    );
  });
});
