import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import AppNotifications from "../AppNotifications.vue";
import type { AppNotification } from "~/composables/useNotifications";

// Mutable refs so per-test overrides work without re-stubbing the global
// after each test. The component calls useNotifications() as a Nuxt
// auto-import global, so vi.stubGlobal is the correct intercept point.
const notificationsRef = ref<AppNotification[]>([]);
const isLoadingRef = ref(false);
const errorRef = ref<string | null>(null);
const mockMarkAllRead = vi.fn();
const mockFetchNotifications = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal("useNotifications", () => ({
  notifications: notificationsRef,
  isLoading: isLoadingRef,
  error: errorRef,
  unreadCount: 0,
  fetchNotifications: mockFetchNotifications,
  markAllRead: mockMarkAllRead,
}));

const SAMPLE_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-1",
    type: "import_ready",
    tone: "info",
    body: "12 geotagged photos from Lisbon are ready to import",
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: "n-2",
    type: "like",
    tone: "accent",
    body: "elsa_far liked your entry",
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: "n-3",
    type: "new_follower",
    tone: "accent",
    body: "Someone started following you",
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
  },
];

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkAllRead.mockResolvedValue(undefined);
    notificationsRef.value = [...SAMPLE_NOTIFICATIONS];
    isLoadingRef.value = false;
    errorRef.value = null;
  });

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

  it("renders notification items from the composable", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.findAll(".notif__item")).toHaveLength(3);
  });

  it("marks unread items with is-unread class", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.findAll(".notif__item.is-unread")).toHaveLength(2);
  });

  it("calls composable markAllRead when mark all read is clicked", async () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    await wrapper.find(".notif__mark").trigger("click");
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
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

  it("renders tone classes for notifications", () => {
    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif__ico--info").exists()).toBe(true);
    expect(wrapper.find(".notif__ico--accent").exists()).toBe(true);
  });

  it("renders the loading state when isLoading is true and list is empty", () => {
    notificationsRef.value = [];
    isLoadingRef.value = true;

    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find(".notif__list").text()).toContain("Loading");
  });

  it("renders the error state when error is set", () => {
    notificationsRef.value = [];
    errorRef.value = "Could not load notifications";

    const wrapper = mount(AppNotifications, {
      props: { open: true },
      ...globalConfig,
    });
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Could not load notifications",
    );
  });
});
