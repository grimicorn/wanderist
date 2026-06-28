import { defineStore } from "pinia";

export interface Place {
  id: string;
  userId: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlaceInput {
  name: string;
  subtitle?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
}

export interface UpdatePlaceInput {
  name?: string;
  subtitle?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
}

export const usePlacesStore = defineStore("places", () => {
  const { apiFetch } = useApiClient();

  const places = ref<Place[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPlaces(filters?: { category?: string }): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const query = filters?.category
        ? `?category=${encodeURIComponent(filters.category)}`
        : "";

      places.value = await apiFetch<Place[]>(`/api/places${query}`);
    } catch (fetchError) {
      error.value =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load places";
      throw fetchError;
    } finally {
      isLoading.value = false;
    }
  }

  async function createPlace(input: CreatePlaceInput): Promise<Place> {
    const created = await apiFetch<Place>("/api/places", {
      method: "POST",
      body: input,
    });

    places.value = [...places.value, created];

    return created;
  }

  async function updatePlace(
    id: string,
    input: UpdatePlaceInput,
  ): Promise<Place> {
    const updated = await apiFetch<Place>(`/api/places/${id}`, {
      method: "PATCH",
      body: input,
    });

    places.value = places.value.map((place) =>
      place.id === id ? updated : place,
    );

    return updated;
  }

  async function deletePlace(id: string): Promise<void> {
    await apiFetch(`/api/places/${id}`, { method: "DELETE" });

    places.value = places.value.filter((place) => place.id !== id);
  }

  return {
    places,
    isLoading,
    error,
    fetchPlaces,
    createPlace,
    updatePlace,
    deletePlace,
  };
});
