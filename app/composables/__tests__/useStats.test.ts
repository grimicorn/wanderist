import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiFetch = vi.fn();

vi.stubGlobal("useState", (key: string, init: () => unknown) => {
  const { ref } = require("vue");
  return ref(init());
});

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: vi.fn(() => ({ apiFetch: mockApiFetch })),
}));

const { useStats } = await import("../useStats");

const SAMPLE_STATS = {
  placesCount: 117,
  countriesCount: 9,
  totalDistanceKm: 77600,
  totalDistanceMi: 48218,
  currentStreak: 14,
  placesThisWeek: 6,
  distanceKmThisWeek: 2254,
  distanceMiThisWeek: 1400,
  distanceUnit: "mi",
};

describe("useStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with zero-value defaults", () => {
    const { stats } = useStats();
    expect(stats.value.placesCount).toBe(0);
    expect(stats.value.countriesCount).toBe(0);
    expect(stats.value.currentStreak).toBe(0);
    expect(stats.value.totalDistanceMi).toBe(0);
    expect(stats.value.distanceUnit).toBe("mi");
  });

  describe("fetchStats", () => {
    it("sets stats on success", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_STATS);

      const { fetchStats, stats } = useStats();
      await fetchStats();

      expect(stats.value).toEqual(SAMPLE_STATS);
    });

    it("calls /api/stats endpoint", async () => {
      mockApiFetch.mockResolvedValue(SAMPLE_STATS);

      const { fetchStats } = useStats();
      await fetchStats();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/stats");
    });

    it("sets loadError when the API call fails with error.data.statusMessage", async () => {
      const serverError = Object.assign(new Error("[GET] 500"), {
        data: { statusMessage: "Internal Server Error" },
      });
      mockApiFetch.mockRejectedValue(serverError);

      const { fetchStats, loadError } = useStats();
      await fetchStats();

      expect(loadError.value).toBe("Internal Server Error");
    });

    it("falls back to error.statusMessage when data is absent", async () => {
      const fetchError = Object.assign(new Error("Bad Request"), {
        statusMessage: "Bad Request fallback",
      });
      mockApiFetch.mockRejectedValue(fetchError);

      const { fetchStats, loadError } = useStats();
      await fetchStats();

      expect(loadError.value).toBe("Bad Request fallback");
    });

    it("falls back to error.message when no statusMessage is present", async () => {
      mockApiFetch.mockRejectedValue(new Error("network down"));

      const { fetchStats, loadError } = useStats();
      await fetchStats();

      expect(loadError.value).toBe("network down");
    });

    it("falls back to generic message when error has no recognizable shape", async () => {
      mockApiFetch.mockRejectedValue("plain string error");

      const { fetchStats, loadError } = useStats();
      await fetchStats();

      expect(loadError.value).toBe("An unexpected error occurred");
    });

    it("exposes isLoading as readonly", () => {
      const { isLoading } = useStats();
      // readonly refs are still readable
      expect(typeof isLoading.value).toBe("boolean");
    });

    it("exposes loadError as readonly", () => {
      const { loadError } = useStats();
      expect(loadError.value).toBeNull();
    });
  });
});
