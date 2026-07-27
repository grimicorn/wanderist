import { defineStore } from "pinia";

export type GuideVisibility = "private" | "public";

export interface Guide {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  readTimeMinutes: number;
  likeCount: number;
  visibility: GuideVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuideInput {
  title: string;
  body?: string;
  readTimeMinutes?: number;
  visibility?: GuideVisibility;
}

export type UpdateGuideInput = Partial<CreateGuideInput>;

export const useGuidesStore = defineStore("guides", () => {
  const { apiFetch } = useApiClient();

  const guides = ref<Guide[]>([]);
  const isLoading = ref(false);
  // Distinct from isLoading: lets a consumer tell "haven't fetched yet" apart
  // from "fetched and the list is genuinely empty", so a page doesn't flash
  // an empty state before its first fetch resolves.
  const hasLoaded = ref(false);
  const error = ref<string | null>(null);

  async function fetchGuides(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      guides.value = await apiFetch<Guide[]>("/api/guides");
      // Set only on success: a failed fetch must not read as "loaded and
      // genuinely empty" (see hasLoaded's comment above) — it should keep
      // reading as "not loaded" so the page keeps showing the error instead
      // of also rendering the empty state underneath it.
      hasLoaded.value = true;
    } catch (fetchError) {
      error.value =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load guides";
      throw fetchError;
    } finally {
      isLoading.value = false;
    }
  }

  async function createGuide(input: CreateGuideInput): Promise<Guide> {
    const created = await apiFetch<Guide>("/api/guides", {
      method: "POST",
      body: input,
    });

    guides.value = [created, ...guides.value];
    // A successful write proves the list is reachable — drop a stale load
    // error rather than leaving it under a list that's now visibly working.
    error.value = null;

    return created;
  }

  async function updateGuide(
    id: string,
    input: UpdateGuideInput,
  ): Promise<Guide> {
    const updated = await apiFetch<Guide>(`/api/guides/${id}`, {
      method: "PATCH",
      body: input,
    });

    guides.value = guides.value.map((guide) =>
      guide.id === id ? updated : guide,
    );
    error.value = null;

    return updated;
  }

  async function deleteGuide(id: string): Promise<void> {
    await apiFetch(`/api/guides/${id}`, { method: "DELETE" });

    guides.value = guides.value.filter((guide) => guide.id !== id);
    error.value = null;
  }

  return {
    guides,
    isLoading,
    hasLoaded,
    error,
    fetchGuides,
    createGuide,
    updateGuide,
    deleteGuide,
  };
});
