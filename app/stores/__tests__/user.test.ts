/**
 * Unit tests for useUserStore
 *
 * The store is a thin wrapper over the useClerkUser() auto-import. These tests
 * verify that it surfaces the Clerk state correctly and that each reactive
 * property delegates to the composable's return value.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";

// ---------------------------------------------------------------------------
// Stub useClerkUser before importing the store so the stub is in place at
// module evaluation time. vitest.setup.ts already stubs it globally; we
// override it here with a controllable version.
// ---------------------------------------------------------------------------

const mockUser = ref<{ id: string } | null>(null);
const mockIsLoaded = ref(false);
const mockIsSignedIn = ref(false);

vi.stubGlobal("useClerkUser", () => ({
  user: mockUser,
  isLoaded: mockIsLoaded,
  isSignedIn: mockIsSignedIn,
}));

const { useUserStore } = await import("../user");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useUserStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Reset Clerk state before each test so they remain independent.
    mockUser.value = null;
    mockIsLoaded.value = false;
    mockIsSignedIn.value = false;
  });

  it("exposes user as null when Clerk has not loaded a user", () => {
    const store = useUserStore();
    expect(store.user).toBeNull();
  });

  it("exposes isLoaded as false before Clerk has initialised", () => {
    const store = useUserStore();
    expect(store.isLoaded).toBe(false);
  });

  it("exposes isSignedIn as false for an unauthenticated session", () => {
    const store = useUserStore();
    expect(store.isSignedIn).toBe(false);
  });

  it("reflects the Clerk user object when signed in", () => {
    mockUser.value = { id: "user-abc" };
    mockIsLoaded.value = true;
    mockIsSignedIn.value = true;

    const store = useUserStore();

    expect(store.user).toEqual({ id: "user-abc" });
    expect(store.isLoaded).toBe(true);
    expect(store.isSignedIn).toBe(true);
  });

  it("reflects isLoaded true without a user when Clerk is loaded but unauthenticated", () => {
    mockIsLoaded.value = true;
    mockIsSignedIn.value = false;
    mockUser.value = null;

    const store = useUserStore();

    expect(store.isLoaded).toBe(true);
    expect(store.isSignedIn).toBe(false);
    expect(store.user).toBeNull();
  });

  it("reflects reactive Clerk state changes after store construction", () => {
    // Create the store while Clerk is still loading.
    const store = useUserStore();
    expect(store.isLoaded).toBe(false);
    expect(store.isSignedIn).toBe(false);

    // Simulate Clerk finishing its initialisation with a signed-in user.
    mockIsLoaded.value = true;
    mockIsSignedIn.value = true;
    mockUser.value = { id: "user-reactive" };

    // The store must expose the updated values reactively, not snapshot them.
    expect(store.isLoaded).toBe(true);
    expect(store.isSignedIn).toBe(true);
    expect(store.user).toEqual({ id: "user-reactive" });
  });
});
