import { defineStore } from "pinia";
import { extractErrorMessage } from "~/utils/extractErrorMessage";

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

function replaceLikeCount(
  list: Guide[],
  id: string,
  likeCount: number,
): Guide[] {
  return list.map((guide) =>
    guide.id === id ? { ...guide, likeCount } : guide,
  );
}

export const useGuidesStore = defineStore("guides", () => {
  const { apiFetch } = useApiClient();

  const guides = ref<Guide[]>([]);
  // Holds the single guide shown on the detail page (/guides/[id]). Kept
  // separate from the `guides` list because a guide can be opened from explore
  // without ever loading the owner's full list, and the detail fetch returns a
  // guide the list may not contain (e.g. someone else's public guide).
  const currentGuide = ref<Guide | null>(null);
  const isLoadingGuide = ref(false);
  const guideError = ref<string | null>(null);
  const isLoading = ref(false);
  // Distinct from isLoading: lets a consumer tell "haven't fetched yet" apart
  // from "fetched and the list is genuinely empty", so a page doesn't flash
  // an empty state before its first fetch resolves.
  const hasLoaded = ref(false);
  const error = ref<string | null>(null);
  // Dedupes concurrent fetchGuides() calls into one request. Without this, a
  // slow mount-triggered fetch overlapping a retry click — or a create/update/
  // delete's markLoadSucceeded() refetch firing while the mount fetch is still
  // in flight — starts a second, redundant request racing the first; whichever
  // settles last wins, which can overwrite fresher state with a stale response.
  let inFlightFetch: Promise<void> | null = null;

  async function fetchGuides(): Promise<void> {
    if (inFlightFetch) {
      return inFlightFetch;
    }

    inFlightFetch = runFetchGuides().finally(() => {
      inFlightFetch = null;
    });

    return inFlightFetch;
  }

  async function runFetchGuides(): Promise<void> {
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
      error.value = extractErrorMessage(fetchError);
      throw fetchError;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchGuideById(id: string): Promise<void> {
    isLoadingGuide.value = true;
    guideError.value = null;

    try {
      currentGuide.value = await apiFetch<Guide>(`/api/guides/${id}`);
    } catch (fetchError) {
      // Clear any stale guide so the detail page shows its not-found state
      // rather than the previously-open guide when a fetch fails.
      currentGuide.value = null;
      guideError.value = extractErrorMessage(fetchError);
      throw fetchError;
    } finally {
      isLoadingGuide.value = false;
    }
  }

  // A successful write only proves the single mutated guide reflects server
  // state, not that `guides` holds the user's complete set. If the initial
  // load never succeeded (hasLoaded still false), `guides` may be missing
  // rows the server has — e.g. it's `[]` after a failed fetchGuides — and a
  // create/update/delete here must not be allowed to make that incomplete
  // list look authoritative. In that case, await a real refetch instead of
  // trusting the local mutation. Once hasLoaded is already true, a write's
  // optimistic mutation is enough and no refetch is needed — just clear any
  // stale load error.
  async function markLoadSucceeded(): Promise<void> {
    if (!hasLoaded.value) {
      await fetchGuides().catch(() => {
        // fetchGuides already records the failure in `error`; nothing further
        // to do here.
      });
      return;
    }

    error.value = null;
  }

  async function createGuide(input: CreateGuideInput): Promise<Guide> {
    const created = await apiFetch<Guide>("/api/guides", {
      method: "POST",
      body: input,
    });

    guides.value = [created, ...guides.value];
    await markLoadSucceeded();

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
    await markLoadSucceeded();

    return updated;
  }

  async function deleteGuide(id: string): Promise<void> {
    await apiFetch(`/api/guides/${id}`, { method: "DELETE" });

    guides.value = guides.value.filter((guide) => guide.id !== id);
    await markLoadSucceeded();
  }

  // Only the returned likeCount is spliced back in (not the whole row) so a
  // concurrent edit to the same guide's other fields isn't clobbered by a
  // like/unlike response that predates it — mirrors likeEntry in stores/entries.ts.
  async function likeGuide(id: string): Promise<Guide> {
    const updated = await apiFetch<Guide>(`/api/guides/${id}/like`, {
      method: "POST",
    });

    guides.value = replaceLikeCount(guides.value, id, updated.likeCount);

    return updated;
  }

  async function unlikeGuide(id: string): Promise<Guide> {
    const updated = await apiFetch<Guide>(`/api/guides/${id}/like`, {
      method: "DELETE",
    });

    guides.value = replaceLikeCount(guides.value, id, updated.likeCount);

    return updated;
  }

  return {
    guides,
    currentGuide,
    isLoadingGuide,
    guideError,
    isLoading,
    hasLoaded,
    error,
    fetchGuides,
    fetchGuideById,
    createGuide,
    updateGuide,
    deleteGuide,
    likeGuide,
    unlikeGuide,
  };
});
