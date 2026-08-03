import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// useApiClient is a Nuxt auto-imported composable. Stub it before importing
// the store so the module resolves against a controlled mock.
const mockApiFetch = vi.fn();
vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// Import after globals are set. guides.ts imports defineStore directly from
// "pinia" (not via a Nuxt auto-import), so no defineStore global stub is
// needed here — a plain import of the real pinia already resolves it.
const { useGuidesStore } = await import("../guides");

describe("useGuidesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchGuides
  // ---------------------------------------------------------------------------

  describe("fetchGuides", () => {
    it("populates guides on success", async () => {
      const mockGuides = [
        { id: "g-1", userId: "u-1", title: "Tokyo on foot" },
        { id: "g-2", userId: "u-1", title: "Slow coastlines" },
      ];
      mockApiFetch.mockResolvedValueOnce(mockGuides);

      const store = useGuidesStore();
      await store.fetchGuides();

      expect(store.guides).toEqual(mockGuides);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it("calls GET /api/guides", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = useGuidesStore();
      await store.fetchGuides();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides");
    });

    it("sets isLoading true during fetch", async () => {
      let capturedLoading = false;
      const store = useGuidesStore();

      mockApiFetch.mockImplementation(async () => {
        capturedLoading = store.isLoading;
        return [];
      });

      await store.fetchGuides();

      expect(capturedLoading).toBe(true);
    });

    it("resets isLoading to false after fetch", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = useGuidesStore();
      await store.fetchGuides();

      expect(store.isLoading).toBe(false);
    });

    it("sets error and rethrows on failure", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));
      const store = useGuidesStore();

      await expect(store.fetchGuides()).rejects.toThrow("Network error");

      expect(store.error).toBe("Network error");
      expect(store.isLoading).toBe(false);
    });

    it("sets hasLoaded on success", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = useGuidesStore();

      expect(store.hasLoaded).toBe(false);
      await store.fetchGuides();

      expect(store.hasLoaded).toBe(true);
    });

    it("does not set hasLoaded when the fetch fails", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));
      const store = useGuidesStore();

      await expect(store.fetchGuides()).rejects.toThrow("Network error");

      expect(store.hasLoaded).toBe(false);
    });

    it("dedupes concurrent calls into a single request", async () => {
      const mockGuides = [{ id: "g-1", userId: "u-1", title: "Tokyo" }];
      let resolveFetch: (value: typeof mockGuides) => void;
      mockApiFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const store = useGuidesStore();
      const first = store.fetchGuides();
      const second = store.fetchGuides();

      resolveFetch!(mockGuides);
      await Promise.all([first, second]);

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(store.guides).toEqual(mockGuides);
    });

    it("allows a fresh request once the in-flight one settles", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = useGuidesStore();

      await store.fetchGuides();
      await store.fetchGuides();

      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchGuideById
  // ---------------------------------------------------------------------------

  describe("fetchGuideById", () => {
    const guide = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };

    it("populates currentGuide on success", async () => {
      mockApiFetch.mockResolvedValueOnce(guide);
      const store = useGuidesStore();

      await store.fetchGuideById("g-1");

      expect(store.currentGuide).toEqual(guide);
      expect(store.isLoadingGuide).toBe(false);
      expect(store.guideError).toBeNull();
    });

    it("calls GET /api/guides/:id", async () => {
      mockApiFetch.mockResolvedValue(guide);
      const store = useGuidesStore();

      await store.fetchGuideById("g-1");

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides/g-1");
    });

    it("sets guideError, clears currentGuide, and rethrows on failure", async () => {
      mockApiFetch.mockRejectedValue(new Error("Not Found"));
      const store = useGuidesStore();

      await expect(store.fetchGuideById("g-1")).rejects.toThrow("Not Found");

      expect(store.currentGuide).toBeNull();
      expect(store.guideError).toBe("Not Found");
      expect(store.isLoadingGuide).toBe(false);
    });

    it("drops a stale response so an older request can't overwrite a newer guide", async () => {
      const slowGuide = { ...guide, id: "g-slow", title: "Slow" };
      const fastGuide = { ...guide, id: "g-fast", title: "Fast" };

      let resolveSlow: (value: typeof slowGuide) => void;
      mockApiFetch
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSlow = resolve;
            }),
        )
        .mockResolvedValueOnce(fastGuide);

      const store = useGuidesStore();
      const slow = store.fetchGuideById("g-slow");
      await store.fetchGuideById("g-fast");

      // The slower first request lands last but must not clobber g-fast.
      resolveSlow!(slowGuide);
      await slow;

      expect(store.currentGuide).toEqual(fastGuide);
    });
  });

  // ---------------------------------------------------------------------------
  // createGuide
  // ---------------------------------------------------------------------------

  describe("createGuide", () => {
    it("creates a guide and prepends it to the list", async () => {
      const newGuide = {
        id: "g-new",
        userId: "u-1",
        title: "Paris in a weekend",
        body: null,
        readTimeMinutes: 5,
        likeCount: 0,
        visibility: "private",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // hasLoaded starts false, so createGuide's markLoadSucceeded triggers a
      // refetch (see the "refetches instead of trusting the local list" test
      // below) — queue its response too, alongside the create response.
      mockApiFetch
        .mockResolvedValueOnce(newGuide) // POST /api/guides
        .mockResolvedValueOnce([newGuide]); // refetch GET /api/guides

      const store = useGuidesStore();
      const result = await store.createGuide({ title: "Paris in a weekend" });

      expect(result).toEqual(newGuide);
      expect(store.guides).toEqual([newGuide]);
    });

    it("calls POST /api/guides with the input body", async () => {
      const newGuide = { id: "g-1", userId: "u-1", title: "Paris" };
      mockApiFetch.mockResolvedValue(newGuide);

      const store = useGuidesStore();
      await store.createGuide({ title: "Paris", readTimeMinutes: 6 });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides", {
        method: "POST",
        body: { title: "Paris", readTimeMinutes: 6 },
      });
    });

    it("prepends to existing guides so the newest guide is first", async () => {
      const existing = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      const created = { id: "g-2", userId: "u-1", title: "Paris" };

      mockApiFetch
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce(created);

      const store = useGuidesStore();
      await store.fetchGuides();
      await store.createGuide({ title: "Paris" });

      expect(store.guides).toHaveLength(2);
      expect(store.guides[0]).toEqual(created);
      expect(store.guides[1]).toEqual(existing);
    });

    it("leaves the list untouched and rethrows when the request fails", async () => {
      const existing = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      mockApiFetch
        .mockResolvedValueOnce([existing])
        .mockRejectedValueOnce(new Error("boom"));

      const store = useGuidesStore();
      await store.fetchGuides();

      await expect(store.createGuide({ title: "Paris" })).rejects.toThrow(
        "boom",
      );
      expect(store.guides).toEqual([existing]);
    });

    it("clears a stale load error on a successful create", async () => {
      const created = { id: "g-1", userId: "u-1", title: "Paris" };
      mockApiFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(created)
        .mockResolvedValueOnce([created]);

      const store = useGuidesStore();
      await expect(store.fetchGuides()).rejects.toThrow("Network error");
      expect(store.error).toBe("Network error");

      await store.createGuide({ title: "Paris" });

      expect(store.error).toBeNull();
    });

    it("refetches instead of trusting the local list when the initial load never succeeded", async () => {
      // hasLoaded is still false here (no prior successful fetchGuides), so
      // `guides` being `[]` doesn't mean the user has no guides — it means
      // they were never loaded. A create must not let the optimistic
      // [created, ...[]] stand in as the complete list.
      const created = { id: "g-new", userId: "u-1", title: "Paris" };
      const created2 = { id: "g-2", userId: "u-1", title: "Tokyo" };
      mockApiFetch
        .mockResolvedValueOnce(created) // POST /api/guides
        .mockResolvedValueOnce([created2, created]); // refetch GET /api/guides

      const store = useGuidesStore();
      expect(store.hasLoaded).toBe(false);

      await store.createGuide({ title: "Paris" });

      expect(mockApiFetch).toHaveBeenCalledTimes(2);
      expect(mockApiFetch).toHaveBeenNthCalledWith(2, "/api/guides");
      expect(store.hasLoaded).toBe(true);
      expect(store.guides).toEqual([created2, created]);
    });

    it("surfaces the refetch error instead of falsely marking the store loaded", async () => {
      const created = { id: "g-new", userId: "u-1", title: "Paris" };
      mockApiFetch
        .mockResolvedValueOnce(created) // POST /api/guides succeeds
        .mockRejectedValueOnce(new Error("refetch failed")); // GET /api/guides fails

      const store = useGuidesStore();

      await store.createGuide({ title: "Paris" });

      expect(store.hasLoaded).toBe(false);
      expect(store.error).toBe("refetch failed");
    });
  });

  // ---------------------------------------------------------------------------
  // updateGuide
  // ---------------------------------------------------------------------------

  describe("updateGuide", () => {
    it("updates the guide in the list", async () => {
      const original = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      const updated = { id: "g-1", userId: "u-1", title: "Tokyo, revised" };

      mockApiFetch
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce(updated);

      const store = useGuidesStore();
      await store.fetchGuides();
      const result = await store.updateGuide("g-1", {
        title: "Tokyo, revised",
      });

      expect(result).toEqual(updated);
      expect(store.guides).toHaveLength(1);
      expect(store.guides[0]).toEqual(updated);
    });

    it("calls PATCH /api/guides/:id with the input body", async () => {
      const updated = { id: "g-1", userId: "u-1", title: "Osaka" };
      mockApiFetch.mockResolvedValue(updated);

      const store = useGuidesStore();
      await store.updateGuide("g-1", { title: "Osaka", visibility: "public" });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides/g-1", {
        method: "PATCH",
        body: { title: "Osaka", visibility: "public" },
      });
    });

    it("leaves other guides untouched", async () => {
      const guide1 = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      const guide2 = { id: "g-2", userId: "u-1", title: "Slow coastlines" };
      const updatedGuide1 = { id: "g-1", userId: "u-1", title: "Tokyo redo" };

      mockApiFetch
        .mockResolvedValueOnce([guide1, guide2])
        .mockResolvedValueOnce(updatedGuide1);

      const store = useGuidesStore();
      await store.fetchGuides();
      await store.updateGuide("g-1", { title: "Tokyo redo" });

      expect(store.guides).toHaveLength(2);
      expect(store.guides[0]).toEqual(updatedGuide1);
      expect(store.guides[1]).toEqual(guide2);
    });

    it("leaves the list untouched and rethrows when the request fails", async () => {
      const guide1 = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      mockApiFetch
        .mockResolvedValueOnce([guide1])
        .mockRejectedValueOnce(new Error("boom"));

      const store = useGuidesStore();
      await store.fetchGuides();

      await expect(
        store.updateGuide("g-1", { title: "New title" }),
      ).rejects.toThrow("boom");
      expect(store.guides).toEqual([guide1]);
    });

    it("syncs the open detail guide when it is the one edited", async () => {
      const original = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      const updated = { id: "g-1", userId: "u-1", title: "Tokyo, revised" };

      mockApiFetch
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(updated)
        // markLoadSucceeded refetches the list because fetchGuideById never
        // set hasLoaded — give that call a clean empty response.
        .mockResolvedValue([]);

      const store = useGuidesStore();
      await store.fetchGuideById("g-1");
      await store.updateGuide("g-1", { title: "Tokyo, revised" });

      expect(store.currentGuide).toEqual(updated);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteGuide
  // ---------------------------------------------------------------------------

  describe("deleteGuide", () => {
    it("removes the guide from the list", async () => {
      const guide1 = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      const guide2 = { id: "g-2", userId: "u-1", title: "Slow coastlines" };

      mockApiFetch
        .mockResolvedValueOnce([guide1, guide2])
        .mockResolvedValueOnce({ success: true });

      const store = useGuidesStore();
      await store.fetchGuides();
      await store.deleteGuide("g-1");

      expect(store.guides).toHaveLength(1);
      expect(store.guides[0]).toEqual(guide2);
    });

    it("calls DELETE /api/guides/:id", async () => {
      mockApiFetch.mockResolvedValue({ success: true });

      const store = useGuidesStore();
      await store.deleteGuide("g-1");

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides/g-1", {
        method: "DELETE",
      });
    });

    it("leaves the list untouched and rethrows when the request fails", async () => {
      const guide1 = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };
      mockApiFetch
        .mockResolvedValueOnce([guide1])
        .mockRejectedValueOnce(new Error("boom"));

      const store = useGuidesStore();
      await store.fetchGuides();

      await expect(store.deleteGuide("g-1")).rejects.toThrow("boom");
      expect(store.guides).toEqual([guide1]);
    });

    it("clears the open detail guide when it is the one deleted", async () => {
      const guide1 = { id: "g-1", userId: "u-1", title: "Tokyo on foot" };

      mockApiFetch
        .mockResolvedValueOnce(guide1)
        .mockResolvedValueOnce({ success: true })
        // markLoadSucceeded refetches the list because fetchGuideById never
        // set hasLoaded — give that call a clean empty response.
        .mockResolvedValue([]);

      const store = useGuidesStore();
      await store.fetchGuideById("g-1");
      await store.deleteGuide("g-1");

      expect(store.currentGuide).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // likeGuide
  // ---------------------------------------------------------------------------

  describe("likeGuide", () => {
    it("increments likeCount in the list", async () => {
      const guide = { id: "g-1", userId: "u-1", title: "Tokyo", likeCount: 0 };
      const liked = { ...guide, likeCount: 1 };
      mockApiFetch.mockResolvedValueOnce([guide]).mockResolvedValueOnce(liked);

      const store = useGuidesStore();
      await store.fetchGuides();

      const result = await store.likeGuide("g-1");

      expect(result).toEqual(liked);
      expect(store.guides[0].likeCount).toBe(1);
    });

    it("calls POST /api/guides/:id/like", async () => {
      const liked = { id: "g-1", userId: "u-1", title: "Tokyo", likeCount: 1 };
      mockApiFetch.mockResolvedValue(liked);

      const store = useGuidesStore();
      await store.likeGuide("g-1");

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides/g-1/like", {
        method: "POST",
      });
    });

    it("rethrows when the request fails", async () => {
      mockApiFetch.mockRejectedValueOnce(new Error("Not found"));

      const store = useGuidesStore();

      await expect(store.likeGuide("missing")).rejects.toThrow("Not found");
    });
  });

  // ---------------------------------------------------------------------------
  // unlikeGuide
  // ---------------------------------------------------------------------------

  describe("unlikeGuide", () => {
    it("decrements likeCount in the list", async () => {
      const guide = { id: "g-1", userId: "u-1", title: "Tokyo", likeCount: 1 };
      const unliked = { ...guide, likeCount: 0 };
      mockApiFetch
        .mockResolvedValueOnce([guide])
        .mockResolvedValueOnce(unliked);

      const store = useGuidesStore();
      await store.fetchGuides();

      const result = await store.unlikeGuide("g-1");

      expect(result).toEqual(unliked);
      expect(store.guides[0].likeCount).toBe(0);
    });

    it("calls DELETE /api/guides/:id/like", async () => {
      const unliked = {
        id: "g-1",
        userId: "u-1",
        title: "Tokyo",
        likeCount: 0,
      };
      mockApiFetch.mockResolvedValue(unliked);

      const store = useGuidesStore();
      await store.unlikeGuide("g-1");

      expect(mockApiFetch).toHaveBeenCalledWith("/api/guides/g-1/like", {
        method: "DELETE",
      });
    });

    it("rethrows when the request fails", async () => {
      mockApiFetch.mockRejectedValueOnce(new Error("Not found"));

      const store = useGuidesStore();

      await expect(store.unlikeGuide("missing")).rejects.toThrow("Not found");
    });
  });
});
