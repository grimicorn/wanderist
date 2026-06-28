import { defineStore } from "pinia";

type TripStatus = "ongoing" | "upcoming" | "past";
type TripVisibility = "private" | "public";
type TripStopStatus = "done" | "next" | "planned";

export interface Trip {
  id: string;
  userId: string;
  name: string;
  status: TripStatus;
  startDate: string | null;
  endDate: string | null;
  coverImageId: string | null;
  distanceKm: number | null;
  visibility: TripVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface TripStop {
  id: string;
  tripId: string;
  placeId: string | null;
  name: string;
  sortOrder: number;
  arriveDate: string | null;
  nights: number | null;
  note: string | null;
  distanceKm: number | null;
  status: TripStopStatus;
}

export interface TripFacts {
  distanceKm: number | null;
  loggedDistanceKm: number | null;
  nights: number | null;
  photoCount: number;
  stopCount: number;
}

export interface TripDetail {
  trip: Trip;
  stops: TripStop[];
  facts: TripFacts;
}

export interface CreateTripPayload {
  name: string;
  status?: TripStatus;
  visibility?: TripVisibility;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PatchTripPayload {
  name?: string;
  status?: TripStatus;
  visibility?: TripVisibility;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreateStopPayload {
  name: string;
  status?: TripStopStatus;
  arriveDate?: string | null;
  nights?: number | null;
  distanceKm?: number | null;
  note?: string | null;
  placeId?: string | null;
}

export interface PatchStopPayload {
  name?: string;
  status?: TripStopStatus;
  arriveDate?: string | null;
  nights?: number | null;
  distanceKm?: number | null;
  note?: string | null;
  placeId?: string | null;
}

export const useTripsStore = defineStore("trips", () => {
  const { apiFetch } = useApiClient();

  const tripList = ref<Trip[]>([]);
  const currentTripDetail = ref<TripDetail | null>(null);
  const isLoadingList = ref(false);
  const isLoadingDetail = ref(false);
  const listError = ref<string | null>(null);
  const detailError = ref<string | null>(null);

  async function fetchTrips(params?: {
    status?: TripStatus | "All";
    sort?: "asc" | "desc";
  }): Promise<void> {
    isLoadingList.value = true;
    listError.value = null;

    try {
      const query = new URLSearchParams();

      if (params?.status && params.status !== "All") {
        query.set("status", params.status);
      }

      if (params?.sort) {
        query.set("sort", params.sort);
      }

      const queryString = query.toString();
      const url = queryString ? `/api/trips?${queryString}` : "/api/trips";

      tripList.value = await apiFetch<Trip[]>(url);
    } catch (error) {
      listError.value =
        error instanceof Error ? error.message : "Failed to load trips";
      throw error;
    } finally {
      isLoadingList.value = false;
    }
  }

  async function fetchTripById(tripId: string): Promise<void> {
    isLoadingDetail.value = true;
    detailError.value = null;

    try {
      currentTripDetail.value = await apiFetch<TripDetail>(
        `/api/trips/${tripId}`,
      );
    } catch (error) {
      detailError.value =
        error instanceof Error ? error.message : "Failed to load trip";
      throw error;
    } finally {
      isLoadingDetail.value = false;
    }
  }

  async function createTrip(payload: CreateTripPayload): Promise<Trip> {
    const trip = await apiFetch<Trip>("/api/trips", {
      method: "POST",
      body: payload,
    });

    tripList.value = [trip, ...tripList.value];

    return trip;
  }

  async function patchTrip(
    tripId: string,
    payload: PatchTripPayload,
  ): Promise<Trip> {
    const updated = await apiFetch<Trip>(`/api/trips/${tripId}`, {
      method: "PATCH",
      body: payload,
    });

    tripList.value = tripList.value.map((trip) =>
      trip.id === tripId ? updated : trip,
    );

    if (currentTripDetail.value?.trip.id === tripId) {
      currentTripDetail.value = {
        ...currentTripDetail.value,
        trip: updated,
      };
    }

    return updated;
  }

  async function deleteTrip(tripId: string): Promise<void> {
    await apiFetch(`/api/trips/${tripId}`, { method: "DELETE" });

    tripList.value = tripList.value.filter((trip) => trip.id !== tripId);

    if (currentTripDetail.value?.trip.id === tripId) {
      currentTripDetail.value = null;
    }
  }

  function sumNullableField<T extends Record<string, unknown>>(
    items: T[],
    key: keyof T,
  ): number | null {
    return items.reduce<number | null>((accumulator, item) => {
      const value = item[key];

      if (value === null || value === undefined) {
        return accumulator;
      }

      return (accumulator ?? 0) + (value as number);
    }, null);
  }

  function recomputeFacts(
    existingFacts: TripFacts,
    stops: TripStop[],
  ): TripFacts {
    return {
      distanceKm: existingFacts.distanceKm,
      loggedDistanceKm: sumNullableField(stops, "distanceKm"),
      nights: sumNullableField(stops, "nights"),
      photoCount: existingFacts.photoCount,
      stopCount: stops.length,
    };
  }

  async function createStop(
    tripId: string,
    payload: CreateStopPayload,
  ): Promise<TripStop> {
    const stop = await apiFetch<TripStop>(`/api/trips/${tripId}/stops`, {
      method: "POST",
      body: payload,
    });

    if (currentTripDetail.value?.trip.id === tripId) {
      const updatedStops = [...currentTripDetail.value.stops, stop];
      currentTripDetail.value = {
        ...currentTripDetail.value,
        stops: updatedStops,
        facts: recomputeFacts(currentTripDetail.value.facts, updatedStops),
      };
    }

    return stop;
  }

  async function patchStop(
    tripId: string,
    stopId: string,
    payload: PatchStopPayload,
  ): Promise<TripStop> {
    const updated = await apiFetch<TripStop>(
      `/api/trips/${tripId}/stops/${stopId}`,
      { method: "PATCH", body: payload },
    );

    if (currentTripDetail.value?.trip.id === tripId) {
      const updatedStops = currentTripDetail.value.stops.map((stop) =>
        stop.id === stopId ? updated : stop,
      );
      currentTripDetail.value = {
        ...currentTripDetail.value,
        stops: updatedStops,
        facts: recomputeFacts(currentTripDetail.value.facts, updatedStops),
      };
    }

    return updated;
  }

  async function deleteStop(tripId: string, stopId: string): Promise<void> {
    await apiFetch(`/api/trips/${tripId}/stops/${stopId}`, {
      method: "DELETE",
    });

    if (currentTripDetail.value?.trip.id === tripId) {
      const updatedStops = currentTripDetail.value.stops.filter(
        (stop) => stop.id !== stopId,
      );
      currentTripDetail.value = {
        ...currentTripDetail.value,
        stops: updatedStops,
        facts: recomputeFacts(currentTripDetail.value.facts, updatedStops),
      };
    }
  }

  async function reorderStops(
    tripId: string,
    stopIds: string[],
  ): Promise<TripStop[]> {
    const reordered = await apiFetch<TripStop[]>(
      `/api/trips/${tripId}/stops/reorder`,
      { method: "PUT", body: { stopIds } },
    );

    if (currentTripDetail.value?.trip.id === tripId) {
      currentTripDetail.value = {
        ...currentTripDetail.value,
        stops: reordered,
      };
    }

    return reordered;
  }

  return {
    tripList,
    currentTripDetail,
    isLoadingList,
    isLoadingDetail,
    listError,
    detailError,
    fetchTrips,
    fetchTripById,
    createTrip,
    patchTrip,
    deleteTrip,
    createStop,
    patchStop,
    deleteStop,
    reorderStops,
  };
});
