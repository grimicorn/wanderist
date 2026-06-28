/**
 * Manages the current user's follow state.
 *
 * - followingIds: reactive set of Clerk user IDs the current user follows
 * - fetchFollowing: loads persisted follow state from the server on demand
 * - toggleFollow: follow or unfollow a user by their Clerk user ID, keeping
 *   local state in sync with the persisted result
 * - isFollowing: returns true if the current user follows the given user ID
 */
export function useFollows() {
  const { apiFetch } = useApiClient();

  const followingIds = useState<Set<string>>(
    "follows:followingIds",
    () => new Set(),
  );
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFollowing(): Promise<void> {
    try {
      const response = await apiFetch<{ followingIds: string[] }>(
        "/api/follows",
      );
      followingIds.value = new Set(response.followingIds);
    } catch (fetchError) {
      console.error("useFollows: failed to load following list", fetchError);
      error.value = "Could not load following list";
    }
  }

  async function follow(userId: string): Promise<void> {
    await apiFetch("/api/follows", {
      method: "POST",
      body: { followeeId: userId },
    });
    followingIds.value = new Set([...followingIds.value, userId]);
  }

  async function unfollow(userId: string): Promise<void> {
    await apiFetch(`/api/follows/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    const updated = new Set(followingIds.value);
    updated.delete(userId);
    followingIds.value = updated;
  }

  async function toggleFollow(userId: string): Promise<void> {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      if (followingIds.value.has(userId)) {
        await unfollow(userId);
      } else {
        await follow(userId);
      }
    } catch (toggleError) {
      console.error("useFollows: toggleFollow failed", toggleError);
      error.value = "Could not update follow state";
    } finally {
      isLoading.value = false;
    }
  }

  function isFollowing(userId: string): boolean {
    return followingIds.value.has(userId);
  }

  return {
    followingIds,
    isLoading,
    error,
    fetchFollowing,
    toggleFollow,
    isFollowing,
  };
}
