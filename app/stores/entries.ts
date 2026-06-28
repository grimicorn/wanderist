import { defineStore } from "pinia";

export interface EntryPhoto {
  id: string;
  entryId: string;
  mediaId: string;
  sortOrder: number;
}

export interface EntryTag {
  id: string;
  name: string;
}

export interface Entry {
  id: string;
  userId: string;
  tripId: string | null;
  placeId: string | null;
  title: string;
  body: string | null;
  occurredAt: string | null;
  visibility: "private" | "public";
  weather: string | null;
  likeCount: number;
  // JSON-serialized ISO strings from the API; not Date objects at runtime.
  createdAt: string;
  updatedAt: string;
  photos: EntryPhoto[];
  tags: EntryTag[];
}

export interface CreateEntryInput {
  title: string;
  body?: string;
  occurredAt?: string;
  tripId?: string;
  placeId?: string;
  tags?: string[];
  photoMediaIds?: string[];
  visibility?: "private" | "public";
  weather?: string;
}

export type UpdateEntryInput = Partial<CreateEntryInput>;

export interface FetchEntriesFilters {
  tripId?: string;
  placeId?: string;
  tab?: "timeline" | "by-trip" | "photos";
  page?: number;
}

export interface FetchEntriesResult {
  entries: Entry[];
  tab: string;
  page: number;
}

type FilterParam = [key: string, value: string | undefined];

function buildEntriesQuery(filters?: FetchEntriesFilters): string {
  const paramPairs: FilterParam[] = [
    ["tripId", filters?.tripId],
    ["placeId", filters?.placeId],
    ["tab", filters?.tab],
    ["page", filters?.page !== undefined ? String(filters.page) : undefined],
  ];

  const params = new URLSearchParams(
    paramPairs
      .filter((pair): pair is [string, string] => pair[1] !== undefined)
      .map(([key, value]) => [key, value]),
  );

  const queryString = params.toString();
  return queryString ? `/api/entries?${queryString}` : "/api/entries";
}

export const useEntriesStore = defineStore("entries", () => {
  const { apiFetch } = useApiClient();

  const entries = ref<Entry[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchEntries(
    filters?: FetchEntriesFilters,
  ): Promise<FetchEntriesResult> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await apiFetch<FetchEntriesResult>(
        buildEntriesQuery(filters),
      );
      entries.value = result.entries;
      return result;
    } catch (fetchError) {
      error.value =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load entries";
      throw fetchError;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchEntry(id: string): Promise<Entry> {
    return apiFetch<Entry>(`/api/entries/${id}`);
  }

  async function createEntry(input: CreateEntryInput): Promise<Entry> {
    const created = await apiFetch<Entry>("/api/entries", {
      method: "POST",
      body: input,
    });

    entries.value = [...entries.value, created];

    return created;
  }

  async function updateEntry(
    id: string,
    input: UpdateEntryInput,
  ): Promise<Entry> {
    const updated = await apiFetch<Entry>(`/api/entries/${id}`, {
      method: "PATCH",
      body: input,
    });

    entries.value = entries.value.map((entry) =>
      entry.id === id ? updated : entry,
    );

    return updated;
  }

  async function deleteEntry(id: string): Promise<void> {
    await apiFetch(`/api/entries/${id}`, { method: "DELETE" });

    entries.value = entries.value.filter((entry) => entry.id !== id);
  }

  async function likeEntry(id: string): Promise<Entry> {
    const updated = await apiFetch<Entry>(`/api/entries/${id}/like`, {
      method: "POST",
    });

    entries.value = entries.value.map((entry) =>
      entry.id === id ? { ...entry, likeCount: updated.likeCount } : entry,
    );

    return updated;
  }

  async function unlikeEntry(id: string): Promise<Entry> {
    const updated = await apiFetch<Entry>(`/api/entries/${id}/like`, {
      method: "DELETE",
    });

    entries.value = entries.value.map((entry) =>
      entry.id === id ? { ...entry, likeCount: updated.likeCount } : entry,
    );

    return updated;
  }

  return {
    entries,
    isLoading,
    error,
    fetchEntries,
    fetchEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    likeEntry,
    unlikeEntry,
  };
});
