/**
 * useDiscover — fetches all discovery data for the explore page.
 *
 * Each section (featured trips, trending places, guides, suggested people) has
 * its own fetch function so callers can refetch a single section independently
 * (e.g. when the active place filter changes).
 */

export interface FeaturedTrip {
  id: string;
  name: string;
  status: string;
  stopCount: number;
  ownerHandle: string | null;
  ownerDisplayName: string | null;
}

export interface TrendingPlace {
  name: string;
  country: string | null;
  category: string | null;
  saveCount: number;
  recentSaveCount: number;
}

export interface DiscoverGuide {
  id: string;
  title: string;
  readTimeMinutes: number;
  likeCount: number;
  ownerHandle: string | null;
  ownerDisplayName: string | null;
}

export interface SuggestedPerson {
  userId: string;
  displayName: string | null;
  handle: string | null;
  homeBase: string | null;
  placeCount: number;
}

export function useDiscover() {
  const { apiFetch } = useApiClient();

  const featuredTrips = ref<FeaturedTrip[]>([]);
  const trendingPlaces = ref<TrendingPlace[]>([]);
  const guides = ref<DiscoverGuide[]>([]);
  const suggestedPeople = ref<SuggestedPerson[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Monotonically increasing counter used to discard out-of-order responses
  // from rapid filter changes.
  let trendingRequestToken = 0;

  async function fetchFeaturedTrips(): Promise<void> {
    const rows = await apiFetch<FeaturedTrip[]>("/api/discover/featured");
    featuredTrips.value = rows;
  }

  async function fetchTrendingPlaces(category: string | null): Promise<void> {
    const token = ++trendingRequestToken;
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    try {
      const rows = await apiFetch<TrendingPlace[]>(
        `/api/discover/trending${params}`,
      );
      if (token !== trendingRequestToken) {
        return;
      }
      error.value = null;
      trendingPlaces.value = rows;
    } catch (fetchError) {
      if (token !== trendingRequestToken) {
        return;
      }
      console.error("useDiscover: fetchTrendingPlaces failed", fetchError);
      error.value = "Could not load trending places";
    }
  }

  async function fetchGuides(): Promise<void> {
    const rows = await apiFetch<DiscoverGuide[]>("/api/discover/guides");
    guides.value = rows;
  }

  async function fetchSuggestedPeople(): Promise<void> {
    const rows = await apiFetch<SuggestedPerson[]>("/api/discover/people");
    suggestedPeople.value = rows;
  }

  async function fetchAll(activeCategory: string | null = null): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await Promise.all([
        fetchFeaturedTrips(),
        fetchTrendingPlaces(activeCategory),
        fetchGuides(),
        fetchSuggestedPeople(),
      ]);
    } catch (fetchError) {
      console.error("useDiscover: fetchAll failed", fetchError);
      error.value = "Could not load discovery content";
    } finally {
      isLoading.value = false;
    }
  }

  return {
    featuredTrips,
    trendingPlaces,
    guides,
    suggestedPeople,
    isLoading,
    error,
    fetchAll,
    fetchTrendingPlaces,
  };
}
