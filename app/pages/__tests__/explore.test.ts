import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import ExplorePage from "../explore.vue";

const iconStub = { template: "<svg data-icon />" };
const topbarStub = {
  template: '<header class="topbar"><slot /></header>',
  props: ["title", "crumb"],
};

const mockToggleFollow = vi.fn();
const mockFetchFollowing = vi.fn();
const followingIds = ref<Set<string>>(new Set());
const pendingUserIds = ref<Set<string>>(new Set());
const followError = ref<string | null>(null);

vi.stubGlobal("useFollows", () => ({
  fetchFollowing: mockFetchFollowing,
  toggleFollow: mockToggleFollow,
  isFollowing: (userId: string) => followingIds.value.has(userId),
  isPending: (userId: string) => pendingUserIds.value.has(userId),
  followingIds,
  pendingUserIds,
  error: followError,
}));

vi.stubGlobal("useApiClient", () => ({ apiFetch: vi.fn() }));

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
    },
  },
};

describe("Explore page (/explore)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    followingIds.value = new Set();
    pendingUserIds.value = new Set();
    followError.value = null;
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.find(".xhero").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the hero section with search input", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.find(".xhero h1").text()).toBe("Where to next?");
    expect(wrapper.find(".xsearch input").exists()).toBe(true);
  });

  it("renders 5 search chips", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".xchip")).toHaveLength(5);
  });

  it("sets hero search value when chip is clicked", async () => {
    const wrapper = mount(ExplorePage, globalConfig);
    const chips = wrapper.findAll(".xchip");
    await chips[0].trigger("click");
    expect(
      (wrapper.find(".xsearch input").element as HTMLInputElement).value,
    ).toBe("Cold-water swims");
  });

  it("renders 3 featured destination cards", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".feat")).toHaveLength(3);
  });

  it("renders featured destination titles", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    const titles = wrapper.findAll(".feat__title").map((el) => el.text());
    expect(titles).toContain("The ring road, slowly");
    expect(titles).toContain("Lisbon to the Algarve");
    expect(titles).toContain("North to south by rail");
  });

  it("renders 6 place filter buttons", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".fbtn")).toHaveLength(6);
    expect(wrapper.find(".fbtn.is-active").text()).toBe("All");
  });

  it("switches active filter when clicked", async () => {
    const wrapper = mount(ExplorePage, globalConfig);
    const filters = wrapper.findAll(".fbtn");
    await filters[1].trigger("click");
    expect(filters[1].classes()).toContain("is-active");
    expect(filters[0].classes()).not.toContain("is-active");
  });

  it("renders 4 trending place cards", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".pcard")).toHaveLength(4);
  });

  it("renders place card names", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    const names = wrapper.findAll(".pcard__name").map((el) => el.text());
    expect(names).toContain("Reynisfjara");
    expect(names).toContain("Alfama");
  });

  it("renders 3 guide cards", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".guide")).toHaveLength(3);
  });

  it("renders 4 people to follow", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    expect(wrapper.findAll(".person")).toHaveLength(4);
  });

  it("calls fetchFollowing on mount", async () => {
    mount(ExplorePage, globalConfig);
    // onMounted is called synchronously in happy-dom
    expect(mockFetchFollowing).toHaveBeenCalledTimes(1);
  });

  it("shows a person as followed when their userId is in followingIds", async () => {
    followingIds.value = new Set(["user_placeholder_yuki"]);
    const wrapper = mount(ExplorePage, globalConfig);
    const followBtns = wrapper.findAll(".person .btn");
    const followingBtn = followBtns.find((btn) =>
      btn.classes().includes("btn--primary"),
    );
    expect(followingBtn).toBeTruthy();
    expect(followingBtn?.text()).toContain("following");
  });

  it("shows no one followed when followingIds is empty", () => {
    const wrapper = mount(ExplorePage, globalConfig);
    const followBtns = wrapper.findAll(".person .btn");
    const followingBtn = followBtns.find((btn) =>
      btn.classes().includes("btn--primary"),
    );
    expect(followingBtn).toBeUndefined();
  });

  it("calls toggleFollow with the correct userId when follow button is clicked", async () => {
    mockToggleFollow.mockResolvedValue(undefined);
    const wrapper = mount(ExplorePage, globalConfig);
    const firstFollowBtn = wrapper.findAll(".person .btn")[0];
    await firstFollowBtn.trigger("click");
    expect(mockToggleFollow).toHaveBeenCalledWith("user_placeholder_elsa");
  });

  it("reflects updated follow state after toggleFollow resolves", async () => {
    mockToggleFollow.mockImplementation(async (userId: string) => {
      followingIds.value = new Set([...followingIds.value, userId]);
    });
    const wrapper = mount(ExplorePage, globalConfig);
    const firstFollowBtn = wrapper.findAll(".person .btn")[0];
    await firstFollowBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(firstFollowBtn.classes()).toContain("btn--primary");
    expect(firstFollowBtn.text()).toContain("following");
  });

  it("disables a follow button while its toggle is pending", async () => {
    pendingUserIds.value = new Set(["user_placeholder_elsa"]);
    const wrapper = mount(ExplorePage, globalConfig);
    const firstFollowBtn = wrapper.findAll(".person .btn")[0];
    expect((firstFollowBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows an error alert when followError is set", async () => {
    followError.value = "Could not update follow state";
    const wrapper = mount(ExplorePage, {
      global: {
        stubs: {
          AppIcon: iconStub,
          AppTopbar: topbarStub,
          AppAlert: {
            template: '<div class="alert-stub" :data-message="message" />',
            props: ["intent", "message", "dismissible"],
          },
        },
      },
    });
    expect(wrapper.find(".alert-stub").exists()).toBe(true);
    expect(wrapper.find(".alert-stub").attributes("data-message")).toBe(
      "Could not update follow state",
    );
  });
});
