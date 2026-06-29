import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import type { TrendingPlace } from "../useDiscover";

const mockApiFetch = vi.fn();

vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// Stub Vue reactivity globals expected in composables
vi.stubGlobal("ref", ref);

import { useDiscover } from "../useDiscover";

describe("useDiscover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialises with empty arrays and no error", () => {
    const discover = useDiscover();
    expect(discover.featuredTrips.value).toEqual([]);
    expect(discover.trendingPlaces.value).toEqual([]);
    expect(discover.guides.value).toEqual([]);
    expect(discover.suggestedPeople.value).toEqual([]);
    expect(discover.isLoading.value).toBe(false);
    expect(discover.error.value).toBeNull();
  });

  it("fetchAll populates all four sections on success", async () => {
    const featuredData = [
      {
        id: "trip-1",
        name: "Iceland",
        status: "past",
        stopCount: 7,
        ownerHandle: "elsa",
        ownerDisplayName: "Elsa",
      },
    ];
    const trendingData = [
      {
        name: "Reynisfjara",
        country: "Iceland",
        category: "nature",
        saveCount: 42,
        recentSaveCount: 18,
      },
    ];
    const guidesData = [
      {
        id: "guide-1",
        title: "Guide to Iceland",
        readTimeMinutes: 8,
        likeCount: 100,
        ownerHandle: "elsa",
        ownerDisplayName: "Elsa",
      },
    ];
    const peopleData = [
      {
        userId: "user-2",
        displayName: "Marco",
        handle: "marco",
        homeBase: "Lisbon",
        placeCount: 84,
      },
    ];

    mockApiFetch
      .mockResolvedValueOnce(featuredData)
      .mockResolvedValueOnce(trendingData)
      .mockResolvedValueOnce(guidesData)
      .mockResolvedValueOnce(peopleData);

    const discover = useDiscover();
    await discover.fetchAll();

    expect(discover.featuredTrips.value).toEqual(featuredData);
    expect(discover.trendingPlaces.value).toEqual(trendingData);
    expect(discover.guides.value).toEqual(guidesData);
    expect(discover.suggestedPeople.value).toEqual(peopleData);
    expect(discover.error.value).toBeNull();
    expect(discover.isLoading.value).toBe(false);
  });

  it("sets error when fetchAll fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    const discover = useDiscover();
    await discover.fetchAll();

    expect(discover.error.value).toBe("Could not load discovery content");
    expect(discover.isLoading.value).toBe(false);
  });

  it("sets error when standalone fetchTrendingPlaces fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    const discover = useDiscover();
    await discover.fetchTrendingPlaces("nature");

    expect(discover.error.value).toBe("Could not load trending places");
  });

  it("fetchTrendingPlaces passes category query param when provided", async () => {
    mockApiFetch.mockResolvedValue([]);

    const discover = useDiscover();
    await discover.fetchTrendingPlaces("nature");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/discover/trending?category=nature",
    );
  });

  it("fetchTrendingPlaces omits query param when category is null", async () => {
    mockApiFetch.mockResolvedValue([]);

    const discover = useDiscover();
    await discover.fetchTrendingPlaces(null);

    expect(mockApiFetch).toHaveBeenCalledWith("/api/discover/trending");
  });

  it("fetchAll calls all four endpoints", async () => {
    mockApiFetch.mockResolvedValue([]);

    const discover = useDiscover();
    await discover.fetchAll();

    const calledUrls = mockApiFetch.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain("/api/discover/featured");
    expect(calledUrls).toContain("/api/discover/trending");
    expect(calledUrls).toContain("/api/discover/guides");
    expect(calledUrls).toContain("/api/discover/people");
  });

  it("fetchAll passes active category to trending endpoint", async () => {
    mockApiFetch.mockResolvedValue([]);

    const discover = useDiscover();
    await discover.fetchAll("coast");

    const trendingCall = mockApiFetch.mock.calls.find((call) =>
      String(call[0]).startsWith("/api/discover/trending"),
    );
    expect(trendingCall?.[0]).toBe("/api/discover/trending?category=coast");
  });

  it("clears error after a successful fetchTrendingPlaces following a failure", async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce([]);

    const discover = useDiscover();

    await discover.fetchTrendingPlaces("nature");
    expect(discover.error.value).toBe("Could not load trending places");

    await discover.fetchTrendingPlaces("coast");
    expect(discover.error.value).toBeNull();
  });

  it("discards a stale trending response when a newer request has been sent", async () => {
    let resolveFirst!: (value: TrendingPlace[]) => void;
    let resolveSecond!: (value: TrendingPlace[]) => void;

    const firstResponse = new Promise<TrendingPlace[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<TrendingPlace[]>((resolve) => {
      resolveSecond = resolve;
    });

    mockApiFetch
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);

    const discover = useDiscover();

    // Fire two requests without awaiting the first.
    const firstFetch = discover.fetchTrendingPlaces("nature");
    const secondFetch = discover.fetchTrendingPlaces("coast");

    // Second response lands first.
    const coastPlaces: TrendingPlace[] = [
      {
        name: "Praia do Guincho",
        country: "Portugal",
        category: "coast",
        saveCount: 80,
        recentSaveCount: 12,
      },
    ];
    resolveSecond(coastPlaces);
    await secondFetch;

    // First (stale) response lands after.
    const naturePlaces: TrendingPlace[] = [
      {
        name: "Þórsmörk",
        country: "Iceland",
        category: "nature",
        saveCount: 400,
        recentSaveCount: 60,
      },
    ];
    resolveFirst(naturePlaces);
    await firstFetch;

    // The stale nature result must not overwrite the coast result.
    expect(discover.trendingPlaces.value).toEqual(coastPlaces);
  });
});
