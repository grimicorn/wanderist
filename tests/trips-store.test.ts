/**
 * Unit tests for useTripsStore
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import * as vue from "vue";

// ---------------------------------------------------------------------------
// Stub Nuxt auto-imports so the store module can be imported in plain Vitest
// ---------------------------------------------------------------------------

const mockApiFetch = vi.fn();

Object.assign(globalThis, {
  ...vue,
  defineStore: (await import("pinia")).defineStore,
  useApiClient: vi.fn(() => ({ apiFetch: mockApiFetch })),
  definePageMeta: vi.fn(),
});

const { useTripsStore } = await import("../app/stores/trips");
import type { Trip, TripStop, TripDetail } from "../app/stores/trips";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_TRIP: Trip = {
  id: "trip-1",
  userId: "user-1",
  name: "Iceland",
  status: "ongoing",
  startDate: "2026-06-20T00:00:00.000Z",
  endDate: "2026-06-29T00:00:00.000Z",
  coverImageId: null,
  distanceKm: 892,
  visibility: "private",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SAMPLE_STOP: TripStop = {
  id: "stop-1",
  tripId: "trip-1",
  placeId: null,
  name: "Reykjavík",
  sortOrder: 0,
  arriveDate: null,
  nights: 2,
  note: null,
  distanceKm: 100,
  status: "done",
};

const SAMPLE_DETAIL: TripDetail = {
  trip: SAMPLE_TRIP,
  stops: [SAMPLE_STOP],
  facts: {
    distanceKm: 892,
    loggedDistanceKm: 100,
    nights: 2,
    photoCount: 5,
    stopCount: 1,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTripsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchTrips
  // ---------------------------------------------------------------------------

  describe("fetchTrips", () => {
    it("populates tripList from the API response", async () => {
      mockApiFetch.mockResolvedValue([SAMPLE_TRIP]);

      const store = useTripsStore();
      await store.fetchTrips();

      expect(store.tripList).toEqual([SAMPLE_TRIP]);
    });

    it("passes a status filter as a query param when provided", async () => {
      mockApiFetch.mockResolvedValue([]);

      const store = useTripsStore();
      await store.fetchTrips({ status: "ongoing" });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=ongoing"),
      );
    });

    it("does not append a status param when status is 'All'", async () => {
      mockApiFetch.mockResolvedValue([]);

      const store = useTripsStore();
      await store.fetchTrips({ status: "All" });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/trips");
    });

    it("sets isLoadingList to true during the request and false after", async () => {
      let resolveLoad!: (value: Trip[]) => void;
      const pending = new Promise<Trip[]>((resolve) => {
        resolveLoad = resolve;
      });
      mockApiFetch.mockReturnValue(pending);

      const store = useTripsStore();
      const fetchPromise = store.fetchTrips();

      expect(store.isLoadingList).toBe(true);

      resolveLoad([]);
      await fetchPromise;

      expect(store.isLoadingList).toBe(false);
    });

    it("sets listError and rethrows when the API call fails", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));

      const store = useTripsStore();

      await expect(store.fetchTrips()).rejects.toThrow("Network error");
      expect(store.listError).toBe("Network error");
    });

    it("clears listError before each new fetch", async () => {
      mockApiFetch.mockRejectedValueOnce(new Error("first error"));
      mockApiFetch.mockResolvedValueOnce([]);

      const store = useTripsStore();
      await store.fetchTrips().catch(() => {});
      expect(store.listError).toBe("first error");

      await store.fetchTrips();
      expect(store.listError).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // fetchTripById
  // ---------------------------------------------------------------------------

  describe("fetchTripById", () => {
    it("populates currentTripDetail", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_DETAIL);

      const store = useTripsStore();
      await store.fetchTripById("trip-1");

      expect(store.currentTripDetail).toEqual(SAMPLE_DETAIL);
    });

    it("sets isLoadingDetail during the request", async () => {
      let resolveLoad!: (value: TripDetail) => void;
      const pending = new Promise<TripDetail>((resolve) => {
        resolveLoad = resolve;
      });
      mockApiFetch.mockReturnValue(pending);

      const store = useTripsStore();
      const fetchPromise = store.fetchTripById("trip-1");

      expect(store.isLoadingDetail).toBe(true);

      resolveLoad(SAMPLE_DETAIL);
      await fetchPromise;

      expect(store.isLoadingDetail).toBe(false);
    });

    it("sets detailError on failure", async () => {
      mockApiFetch.mockRejectedValue(new Error("Not found"));

      const store = useTripsStore();
      await expect(store.fetchTripById("trip-1")).rejects.toThrow("Not found");

      expect(store.detailError).toBe("Not found");
    });
  });

  // ---------------------------------------------------------------------------
  // createTrip
  // ---------------------------------------------------------------------------

  describe("createTrip", () => {
    it("prepends the new trip to tripList", async () => {
      const existing: Trip = { ...SAMPLE_TRIP, id: "trip-old" };
      const created: Trip = { ...SAMPLE_TRIP, id: "trip-new" };
      mockApiFetch.mockResolvedValue(created);

      const store = useTripsStore();
      store.tripList = [existing];

      await store.createTrip({ name: "New Trip" });

      expect(store.tripList[0]).toEqual(created);
      expect(store.tripList[1]).toEqual(existing);
    });

    it("returns the created trip", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_TRIP);

      const store = useTripsStore();
      const result = await store.createTrip({ name: "Iceland" });

      expect(result).toEqual(SAMPLE_TRIP);
    });
  });

  // ---------------------------------------------------------------------------
  // patchTrip
  // ---------------------------------------------------------------------------

  describe("patchTrip", () => {
    it("updates the matching trip in tripList", async () => {
      const updated: Trip = { ...SAMPLE_TRIP, name: "Iceland Renamed" };
      mockApiFetch.mockResolvedValue(updated);

      const store = useTripsStore();
      store.tripList = [SAMPLE_TRIP];

      await store.patchTrip("trip-1", { name: "Iceland Renamed" });

      expect(store.tripList[0].name).toBe("Iceland Renamed");
    });

    it("updates currentTripDetail when it matches the patched trip", async () => {
      const updated: Trip = { ...SAMPLE_TRIP, name: "Iceland Renamed" };
      mockApiFetch.mockResolvedValue(updated);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.patchTrip("trip-1", { name: "Iceland Renamed" });

      expect(store.currentTripDetail?.trip.name).toBe("Iceland Renamed");
    });

    it("does not update currentTripDetail when it is a different trip", async () => {
      const updated: Trip = { ...SAMPLE_TRIP, id: "trip-2", name: "Other" };
      mockApiFetch.mockResolvedValue(updated);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.patchTrip("trip-2", { name: "Other" });

      expect(store.currentTripDetail?.trip.name).toBe("Iceland");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTrip
  // ---------------------------------------------------------------------------

  describe("deleteTrip", () => {
    it("removes the trip from tripList", async () => {
      mockApiFetch.mockResolvedValue({ ok: true });

      const store = useTripsStore();
      store.tripList = [SAMPLE_TRIP];

      await store.deleteTrip("trip-1");

      expect(store.tripList).toHaveLength(0);
    });

    it("clears currentTripDetail when the deleted trip matches", async () => {
      mockApiFetch.mockResolvedValue({ ok: true });

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.deleteTrip("trip-1");

      expect(store.currentTripDetail).toBeNull();
    });

    it("does not clear currentTripDetail when a different trip is deleted", async () => {
      mockApiFetch.mockResolvedValue({ ok: true });

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.deleteTrip("trip-99");

      expect(store.currentTripDetail).toEqual(SAMPLE_DETAIL);
    });
  });

  // ---------------------------------------------------------------------------
  // createStop
  // ---------------------------------------------------------------------------

  describe("createStop", () => {
    it("appends the new stop to currentTripDetail.stops", async () => {
      const newStop: TripStop = {
        ...SAMPLE_STOP,
        id: "stop-2",
        name: "Vík",
        sortOrder: 1,
      };
      mockApiFetch.mockResolvedValue(newStop);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.createStop("trip-1", { name: "Vík" });

      expect(store.currentTripDetail?.stops).toHaveLength(2);
      expect(store.currentTripDetail?.stops[1]).toEqual(newStop);
    });

    it("recomputes all facts after adding the stop", async () => {
      const newStop: TripStop = {
        ...SAMPLE_STOP,
        id: "stop-2",
        name: "Vík",
        sortOrder: 1,
        distanceKm: 50,
        nights: 1,
      };
      mockApiFetch.mockResolvedValue(newStop);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.createStop("trip-1", { name: "Vík" });

      expect(store.currentTripDetail?.facts.stopCount).toBe(2);
      expect(store.currentTripDetail?.facts.loggedDistanceKm).toBe(150);
      expect(store.currentTripDetail?.facts.nights).toBe(3);
    });

    it("returns the created stop", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_STOP);

      const store = useTripsStore();
      const result = await store.createStop("trip-1", { name: "Reykjavík" });

      expect(result).toEqual(SAMPLE_STOP);
    });
  });

  // ---------------------------------------------------------------------------
  // patchStop
  // ---------------------------------------------------------------------------

  describe("patchStop", () => {
    it("replaces the matching stop in currentTripDetail.stops", async () => {
      const updated: TripStop = { ...SAMPLE_STOP, name: "Reykjavík Updated" };
      mockApiFetch.mockResolvedValue(updated);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.patchStop("trip-1", "stop-1", { name: "Reykjavík Updated" });

      expect(store.currentTripDetail?.stops[0].name).toBe("Reykjavík Updated");
    });

    it("recomputes facts when stop distance changes", async () => {
      const updated: TripStop = {
        ...SAMPLE_STOP,
        distanceKm: 200,
        nights: 5,
      };
      mockApiFetch.mockResolvedValue(updated);

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.patchStop("trip-1", "stop-1", { distanceKm: 200, nights: 5 });

      expect(store.currentTripDetail?.facts.loggedDistanceKm).toBe(200);
      expect(store.currentTripDetail?.facts.nights).toBe(5);
      expect(store.currentTripDetail?.facts.stopCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteStop
  // ---------------------------------------------------------------------------

  describe("deleteStop", () => {
    it("removes the stop from currentTripDetail.stops", async () => {
      mockApiFetch.mockResolvedValue({ ok: true });

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.deleteStop("trip-1", "stop-1");

      expect(store.currentTripDetail?.stops).toHaveLength(0);
    });

    it("recomputes all facts after removing the stop", async () => {
      mockApiFetch.mockResolvedValue({ ok: true });

      const store = useTripsStore();
      store.currentTripDetail = SAMPLE_DETAIL;

      await store.deleteStop("trip-1", "stop-1");

      expect(store.currentTripDetail?.facts.stopCount).toBe(0);
      expect(store.currentTripDetail?.facts.loggedDistanceKm).toBeNull();
      expect(store.currentTripDetail?.facts.nights).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // reorderStops
  // ---------------------------------------------------------------------------

  describe("reorderStops", () => {
    it("replaces stops in currentTripDetail with the reordered list", async () => {
      const reordered: TripStop[] = [
        { ...SAMPLE_STOP, id: "stop-2", name: "Vík", sortOrder: 0 },
        { ...SAMPLE_STOP, id: "stop-1", name: "Reykjavík", sortOrder: 1 },
      ];
      mockApiFetch.mockResolvedValue(reordered);

      const store = useTripsStore();
      store.currentTripDetail = {
        ...SAMPLE_DETAIL,
        stops: [
          SAMPLE_STOP,
          { ...SAMPLE_STOP, id: "stop-2", name: "Vík", sortOrder: 1 },
        ],
      };

      const result = await store.reorderStops("trip-1", ["stop-2", "stop-1"]);

      expect(store.currentTripDetail?.stops).toEqual(reordered);
      expect(result).toEqual(reordered);
    });
  });
});
