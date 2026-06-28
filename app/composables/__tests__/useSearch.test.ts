import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vue from "vue";

const mockApiFetch = vi.fn();

vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

const { useSearch } = await import("../useSearch");

const EMPTY_GROUPS = { places: [], trips: [], entries: [], people: [] };

const SAMPLE_API_RESPONSE = {
  places: [
    {
      id: "p-1",
      name: "Reykjavík",
      subtitle: "Capital",
      country: "Iceland",
      category: "city",
    },
  ],
  trips: [{ id: "t-1", name: "Iceland Ring Road", status: "past" }],
  entries: [{ id: "e-1", title: "Harbor at 4am", body: "Cold morning" }],
  people: [
    {
      id: "u-2",
      displayName: "Elsa Far",
      handle: "elsa_far",
      email: "elsa@example.com",
    },
  ],
};

describe("useSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty results and no loading or error state", () => {
    const { results, isLoading, error } = useSearch();

    expect(results.value).toEqual(EMPTY_GROUPS);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("returns empty groups when search is called with an empty string", async () => {
    const { search, results } = useSearch();

    await search("");

    expect(results.value).toEqual(EMPTY_GROUPS);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("returns empty groups when search is called with whitespace only", async () => {
    const { search, results } = useSearch();

    await search("   ");

    expect(results.value).toEqual(EMPTY_GROUPS);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("calls /api/search with the encoded query on a non-empty search", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search } = useSearch();

    await search("reyk");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/search?q=reyk");
  });

  it("encodes special characters in the query string", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search } = useSearch();

    await search("north & east");

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/search?q=${encodeURIComponent("north & east")}`,
    );
  });

  it("trims whitespace from the query before encoding", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search } = useSearch();

    await search("  reyk  ");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/search?q=reyk");
  });

  it("maps places to SearchItems with pin icon and /map href", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search, results } = useSearch();

    await search("reyk");

    const place = results.value.places[0];
    expect(place.id).toBe("p-1");
    expect(place.title).toBe("Reykjavík");
    expect(place.icon).toBe("pin");
    expect(place.href).toBe("/map");
  });

  it("combines place subtitle and country into a single subtitle string", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search, results } = useSearch();

    await search("reyk");

    const place = results.value.places[0];
    expect(place.subtitle).toBe("Capital · Iceland");
  });

  it("maps trips to SearchItems with route icon and /trips/:id href", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search, results } = useSearch();

    await search("iceland");

    const trip = results.value.trips[0];
    expect(trip.id).toBe("t-1");
    expect(trip.title).toBe("Iceland Ring Road");
    expect(trip.icon).toBe("route");
    expect(trip.href).toBe("/trips/t-1");
  });

  it("maps entries to SearchItems with journal icon and /journal href", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search, results } = useSearch();

    await search("harbor");

    const entry = results.value.entries[0];
    expect(entry.id).toBe("e-1");
    expect(entry.title).toBe("Harbor at 4am");
    expect(entry.icon).toBe("journal");
    expect(entry.href).toBe("/journal");
  });

  it("maps people to SearchItems with user icon and @handle as title", async () => {
    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    const { search, results } = useSearch();

    await search("elsa");

    const person = results.value.people[0];
    expect(person.id).toBe("u-2");
    expect(person.title).toBe("@elsa_far");
    expect(person.icon).toBe("user");
    expect(person.href).toBe("/explore");
  });

  it("falls back to displayName as people title when handle is null", async () => {
    mockApiFetch.mockResolvedValue({
      ...SAMPLE_API_RESPONSE,
      people: [
        {
          id: "u-3",
          displayName: "Marco Reis",
          handle: null,
          email: "marco@example.com",
        },
      ],
    });
    const { search, results } = useSearch();

    await search("marco");

    expect(results.value.people[0].title).toBe("Marco Reis");
  });

  it("falls back to email as people title when both handle and displayName are null", async () => {
    mockApiFetch.mockResolvedValue({
      ...SAMPLE_API_RESPONSE,
      people: [
        {
          id: "u-4",
          displayName: null,
          handle: null,
          email: "anon@example.com",
        },
      ],
    });
    const { search, results } = useSearch();

    await search("anon");

    expect(results.value.people[0].title).toBe("anon@example.com");
  });

  it("sets isLoading to true during a fetch and false after it resolves", async () => {
    let resolveSearch!: () => void;
    const pending = new Promise<typeof SAMPLE_API_RESPONSE>((resolve) => {
      resolveSearch = () => resolve(SAMPLE_API_RESPONSE);
    });
    mockApiFetch.mockReturnValue(pending);

    const { search, isLoading } = useSearch();

    const inFlight = search("reyk");
    expect(isLoading.value).toBe(true);

    resolveSearch();
    await inFlight;
    expect(isLoading.value).toBe(false);
  });

  it("sets error when the fetch fails and resets results to empty", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const { search, error, results } = useSearch();

    await search("reyk");

    expect(error.value).toBeTruthy();
    expect(results.value).toEqual(EMPTY_GROUPS);
  });

  it("clears error at the start of a successful fetch after a prior failure", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
    const { search, error } = useSearch();
    await search("reyk");
    expect(error.value).toBeTruthy();

    mockApiFetch.mockResolvedValue(SAMPLE_API_RESPONSE);
    await search("tokyo");
    expect(error.value).toBeNull();
  });

  it("does not throw when the fetch fails (logs instead)", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    const { search } = useSearch();

    await expect(search("reyk")).resolves.toBeUndefined();
  });

  it("exposes a reactive query ref that is initially empty", () => {
    const { query } = useSearch();
    expect(query.value).toBe("");
  });
});
