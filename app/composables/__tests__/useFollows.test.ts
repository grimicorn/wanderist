import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vue from "vue";

const mockApiFetch = vi.fn();

vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// useState in vitest.setup.ts: useState<T>(key, init?) => ref(init?.())
// The global setup already provides this; it's available because vitest.setup.ts
// runs before this file. We re-stub it here so each test gets a fresh ref.
vi.stubGlobal("useState", <T>(_key: string, init?: () => T) =>
  vue.ref(init?.()),
);

const { useFollows } = await import("../useFollows");

describe("useFollows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes followingIds as an empty Set", () => {
    const { followingIds } = useFollows();
    expect(followingIds.value.size).toBe(0);
  });

  it("fetchFollowing populates followingIds from the API response", async () => {
    mockApiFetch.mockResolvedValue({ followingIds: ["user-2", "user-3"] });
    const { fetchFollowing, followingIds } = useFollows();

    await fetchFollowing();

    expect(followingIds.value).toEqual(new Set(["user-2", "user-3"]));
  });

  it("fetchFollowing does not throw on API error (logs it instead)", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const { fetchFollowing, error } = useFollows();

    await expect(fetchFollowing()).resolves.toBeUndefined();
    expect(error.value).toBeTruthy();
  });

  it("isFollowing returns true for an ID that is in followingIds", async () => {
    mockApiFetch.mockResolvedValue({ followingIds: ["user-2"] });
    const { fetchFollowing, isFollowing } = useFollows();
    await fetchFollowing();

    expect(isFollowing("user-2")).toBe(true);
  });

  it("isFollowing returns false for an ID not in followingIds", () => {
    const { isFollowing } = useFollows();
    expect(isFollowing("user-nobody")).toBe(false);
  });

  it("toggleFollow calls POST /api/follows and adds the userId to followingIds", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { toggleFollow, followingIds } = useFollows();

    await toggleFollow("user-2");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/follows", {
      method: "POST",
      body: { followeeId: "user-2" },
    });
    expect(followingIds.value.has("user-2")).toBe(true);
  });

  it("toggleFollow calls DELETE /api/follows/:id and removes the userId from followingIds", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ followingIds: ["user-2"] })
      .mockResolvedValue({ ok: true });

    const { fetchFollowing, toggleFollow, followingIds } = useFollows();
    await fetchFollowing();

    await toggleFollow("user-2");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/follows/user-2", {
      method: "DELETE",
    });
    expect(followingIds.value.has("user-2")).toBe(false);
  });

  it("toggleFollow does not throw on API error and sets error state", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    const { toggleFollow, error } = useFollows();

    await expect(toggleFollow("user-2")).resolves.toBeUndefined();
    expect(error.value).toBeTruthy();
  });

  it("toggleFollow is a no-op when a toggle is already in progress (isLoading guard)", async () => {
    let resolveFirst!: () => void;
    const firstCallPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mockApiFetch.mockReturnValueOnce(
      firstCallPromise.then(() => ({ ok: true })),
    );

    const { toggleFollow } = useFollows();

    // Start the first toggle without awaiting
    const firstToggle = toggleFollow("user-2");

    // Attempt a second toggle while the first is in flight
    const secondToggle = toggleFollow("user-2");

    resolveFirst();
    await firstToggle;
    await secondToggle;

    // Only the first call should have reached the API
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});
