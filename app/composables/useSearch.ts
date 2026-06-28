/**
 * useSearch — calls GET /api/search?q= and returns grouped, UI-ready result
 * items. All four groups (places, trips, entries, people) map to the same
 * SearchItem shape that AppCommandPalette, explore, and map already use.
 */

export interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  href: string;
}

export interface SearchGroups {
  places: SearchItem[];
  trips: SearchItem[];
  entries: SearchItem[];
  people: SearchItem[];
}

interface PlaceResult {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  category: string | null;
}

interface TripResult {
  id: string;
  name: string;
  status: string;
}

interface EntryResult {
  id: string;
  title: string;
  body: string | null;
}

interface PersonResult {
  id: string;
  displayName: string | null;
  handle: string | null;
  email: string;
}

interface SearchApiResponse {
  places: PlaceResult[];
  trips: TripResult[];
  entries: EntryResult[];
  people: PersonResult[];
}

const EMPTY_GROUPS: SearchGroups = {
  places: [],
  trips: [],
  entries: [],
  people: [],
};

function mapPlace(place: PlaceResult): SearchItem {
  const subtitle =
    [place.subtitle, place.country].filter(Boolean).join(" · ") || undefined;
  return {
    id: place.id,
    title: place.name,
    subtitle,
    icon: "pin",
    href: "/map",
  };
}

function mapTrip(trip: TripResult): SearchItem {
  return {
    id: trip.id,
    title: trip.name,
    subtitle: trip.status,
    icon: "route",
    href: `/trips/${trip.id}`,
  };
}

function mapEntry(entry: EntryResult): SearchItem {
  return {
    id: entry.id,
    title: entry.title,
    icon: "journal",
    href: "/journal",
  };
}

function mapPerson(person: PersonResult): SearchItem {
  const title = person.handle
    ? `@${person.handle.replace(/^@/, "")}`
    : (person.displayName ?? person.email);
  const subtitle =
    person.displayName && person.handle ? person.displayName : undefined;
  return {
    id: person.id,
    title,
    subtitle,
    icon: "user",
    href: "/explore",
  };
}

function mapApiResponse(response: SearchApiResponse): SearchGroups {
  return {
    places: response.places.map(mapPlace),
    trips: response.trips.map(mapTrip),
    entries: response.entries.map(mapEntry),
    people: response.people.map(mapPerson),
  };
}

/**
 * Provides a reactive search composable backed by GET /api/search?q=.
 *
 * - `query`: the search string to bind to an input
 * - `results`: reactive grouped search results (empty until query is non-empty)
 * - `isLoading`: true while the fetch is in flight
 * - `error`: set when the fetch fails; null otherwise
 * - `search`: call explicitly to trigger a search with the current query value
 */
export function useSearch() {
  const { apiFetch } = useApiClient();

  const query = ref("");
  const results = ref<SearchGroups>({ ...EMPTY_GROUPS });
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function search(searchQuery: string): Promise<void> {
    const trimmed = searchQuery.trim();

    if (!trimmed) {
      results.value = { ...EMPTY_GROUPS };
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiFetch<SearchApiResponse>(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
      );
      results.value = mapApiResponse(response);
    } catch (fetchError) {
      console.error("useSearch: search failed", fetchError);
      error.value = "Search failed. Please try again.";
      results.value = { ...EMPTY_GROUPS };
    } finally {
      isLoading.value = false;
    }
  }

  return {
    query,
    results,
    isLoading,
    error,
    search,
  };
}
