import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vue from "vue";

// useApiClient is a Nuxt auto-imported composable. Stub it before importing
// the store so the module resolves against a controlled mock.
const mockApiFetch = vi.fn();
vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// defineStore is stubbed as vi.fn() in vitest.setup.ts for component tests.
// For store unit tests we need the real pinia defineStore so restore it here.
const { createPinia, setActivePinia, defineStore } = await import("pinia");
vi.stubGlobal("defineStore", defineStore);

// Import after globals are set.
const { usePlacesStore } = await import("../places");

describe("usePlacesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchPlaces
  // ---------------------------------------------------------------------------

  describe("fetchPlaces", () => {
    it("populates places on success", async () => {
      const mockPlaces = [
        { id: "p-1", userId: "u-1", name: "Tokyo" },
        { id: "p-2", userId: "u-1", name: "London" },
      ];
      mockApiFetch.mockResolvedValue(mockPlaces);

      const store = usePlacesStore();
      await store.fetchPlaces();

      expect(store.places).toEqual(mockPlaces);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it("sets isLoading true during fetch", async () => {
      let capturedLoading = false;
      mockApiFetch.mockImplementation(async () => {
        capturedLoading = true;
        return [];
      });

      const store = usePlacesStore();
      await store.fetchPlaces();

      expect(capturedLoading).toBe(true);
    });

    it("resets isLoading to false after fetch", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = usePlacesStore();
      await store.fetchPlaces();

      expect(store.isLoading).toBe(false);
    });

    it("sets error and rethrows on failure", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));
      const store = usePlacesStore();

      await expect(store.fetchPlaces()).rejects.toThrow("Network error");

      expect(store.error).toBe("Network error");
      expect(store.isLoading).toBe(false);
    });

    it("calls /api/places with no query when no filters", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = usePlacesStore();
      await store.fetchPlaces();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/places");
    });

    it("appends category query param when filter is provided", async () => {
      mockApiFetch.mockResolvedValue([]);
      const store = usePlacesStore();
      await store.fetchPlaces({ category: "museum" });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/places?category=museum");
    });
  });

  // ---------------------------------------------------------------------------
  // createPlace
  // ---------------------------------------------------------------------------

  describe("createPlace", () => {
    it("creates a place and appends it to the list", async () => {
      const newPlace = {
        id: "p-new",
        userId: "u-1",
        name: "Paris",
        subtitle: "France",
        country: "France",
        category: "city",
        latitude: 48.8566,
        longitude: 2.3522,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockApiFetch.mockResolvedValue(newPlace);

      const store = usePlacesStore();
      const result = await store.createPlace({ name: "Paris" });

      expect(result).toEqual(newPlace);
      expect(store.places).toEqual(expect.arrayContaining([newPlace]));
    });

    it("calls POST /api/places with the input body", async () => {
      const newPlace = { id: "p-1", userId: "u-1", name: "Paris" };
      mockApiFetch.mockResolvedValue(newPlace);

      const store = usePlacesStore();
      await store.createPlace({ name: "Paris", latitude: 48.8566 });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/places", {
        method: "POST",
        body: { name: "Paris", latitude: 48.8566 },
      });
    });

    it("appends to existing places", async () => {
      const existing = { id: "p-1", userId: "u-1", name: "Tokyo" };
      const created = { id: "p-2", userId: "u-1", name: "Paris" };

      mockApiFetch
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce(created);

      const store = usePlacesStore();
      await store.fetchPlaces();
      await store.createPlace({ name: "Paris" });

      expect(store.places).toHaveLength(2);
      expect(store.places[1]).toEqual(created);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePlace
  // ---------------------------------------------------------------------------

  describe("updatePlace", () => {
    it("updates the place in the list", async () => {
      const original = { id: "p-1", userId: "u-1", name: "Tokyo" };
      const updated = { id: "p-1", userId: "u-1", name: "Osaka" };

      mockApiFetch
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce(updated);

      const store = usePlacesStore();
      await store.fetchPlaces();
      const result = await store.updatePlace("p-1", { name: "Osaka" });

      expect(result).toEqual(updated);
      expect(store.places).toHaveLength(1);
      expect(store.places[0]).toEqual(updated);
    });

    it("calls PATCH /api/places/:id with the input body", async () => {
      const updated = { id: "p-1", userId: "u-1", name: "Osaka" };
      mockApiFetch.mockResolvedValue(updated);

      const store = usePlacesStore();
      await store.updatePlace("p-1", { name: "Osaka", category: "city" });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/places/p-1", {
        method: "PATCH",
        body: { name: "Osaka", category: "city" },
      });
    });

    it("leaves other places untouched", async () => {
      const place1 = { id: "p-1", userId: "u-1", name: "Tokyo" };
      const place2 = { id: "p-2", userId: "u-1", name: "London" };
      const updatedPlace1 = { id: "p-1", userId: "u-1", name: "Osaka" };

      mockApiFetch
        .mockResolvedValueOnce([place1, place2])
        .mockResolvedValueOnce(updatedPlace1);

      const store = usePlacesStore();
      await store.fetchPlaces();
      await store.updatePlace("p-1", { name: "Osaka" });

      expect(store.places).toHaveLength(2);
      expect(store.places[0]).toEqual(updatedPlace1);
      expect(store.places[1]).toEqual(place2);
    });
  });

  // ---------------------------------------------------------------------------
  // deletePlace
  // ---------------------------------------------------------------------------

  describe("deletePlace", () => {
    it("removes the place from the list", async () => {
      const place1 = { id: "p-1", userId: "u-1", name: "Tokyo" };
      const place2 = { id: "p-2", userId: "u-1", name: "London" };

      mockApiFetch
        .mockResolvedValueOnce([place1, place2])
        .mockResolvedValueOnce({ success: true });

      const store = usePlacesStore();
      await store.fetchPlaces();
      await store.deletePlace("p-1");

      expect(store.places).toHaveLength(1);
      expect(store.places[0]).toEqual(place2);
    });

    it("calls DELETE /api/places/:id", async () => {
      mockApiFetch.mockResolvedValue({ success: true });

      const store = usePlacesStore();
      await store.deletePlace("p-1");

      expect(mockApiFetch).toHaveBeenCalledWith("/api/places/p-1", {
        method: "DELETE",
      });
    });
  });
});
