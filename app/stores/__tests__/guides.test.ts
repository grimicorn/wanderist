import { describe, it, expect, vi, beforeEach } from "vitest";

// useApiClient is a Nuxt auto-imported composable. Stub it before importing
// the store so the module resolves against a controlled mock.
const mockApiFetch = vi.fn();
vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// defineStore is stubbed as vi.fn() in vitest.setup.ts for component tests.
// For store unit tests we need the real pinia defineStore so restore it here.
const { createPinia, setActivePinia, defineStore } = await import("pinia");
vi.stubGlobal("defineStore", defineStore);

// Import after globals are set.
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
      mockApiFetch.mockResolvedValue(newGuide);

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
  });
});
