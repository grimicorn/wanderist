import * as vue from "vue";
import { vi } from "vitest";

// Expose Vue composition API as globals to match Nuxt's auto-import behavior
Object.assign(globalThis, vue);

// Stub Nuxt-only composables that are unavailable in plain Vitest
Object.assign(globalThis, {
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
  useRoute: vi.fn(() => ({ params: {}, query: {} })),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  navigateTo: vi.fn(),
  useState: <T>(key: string, init?: () => T) => vue.ref(init?.()),
  useId: (() => {
    let n = 0;
    return () => `test-id-${++n}`;
  })(),
  useNuxtApp: vi.fn(() => ({})),
  useRuntimeConfig: vi.fn(() => ({ public: {} })),
  useScrollReveal: vi.fn(),
  // Clerk composables
  useClerkAuth: vi.fn(() => ({
    isSignedIn: vue.ref(false),
    isLoaded: vue.ref(true),
  })),
  useClerkUser: vi.fn(() => ({ user: vue.ref(null) })),
  // Nuxt page macros
  definePageMeta: vi.fn(),
  // Pinia
  defineStore: vi.fn(),
  // App composables — stubs for environments that don't import them explicitly
  useApiClient: vi.fn(() => ({ apiFetch: vi.fn() })),
  useAccountActions: vi.fn(() => ({
    isLoading: vue.readonly(vue.ref(false)),
    error: vue.readonly(vue.ref(null)),
    changePassword: vi.fn().mockResolvedValue(true),
    uploadAvatar: vi.fn().mockResolvedValue(null),
    removeAvatar: vi.fn().mockResolvedValue(true),
    deleteAccount: vi.fn().mockResolvedValue(true),
  })),
  usePreferences: vi.fn(() => ({
    preferences: vue.ref({
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
      displayName: null,
      handle: null,
      homeBase: null,
      bio: null,
    }),
    isLoading: vue.ref(false),
    loadError: vue.ref(null),
    saveError: vue.ref(null),
    fetchPreferences: vi.fn().mockResolvedValue(undefined),
    savePreferences: vi.fn().mockResolvedValue(true),
  })),
});
