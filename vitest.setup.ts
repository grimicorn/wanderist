import * as vue from "vue";
import { vi } from "vitest";
import { defineStore } from "pinia";

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
  useRuntimeConfig: vi.fn(() => ({ public: { mapboxToken: "" } })),
  useScrollReveal: vi.fn(),
  // Clerk composables
  useClerkAuth: vi.fn(() => ({
    isSignedIn: vue.ref(false),
    isLoaded: vue.ref(true),
    getToken: vi.fn().mockResolvedValue(null),
  })),
  useClerkUser: vi.fn(() => ({ user: vue.ref(null) })),
  // Nuxt page macros
  definePageMeta: vi.fn(),
  // Pinia — use the real defineStore so stores work in component tests
  defineStore,
  // App composables — stubs for environments that don't import them explicitly
  useApiClient: vi.fn(() => ({ apiFetch: vi.fn().mockResolvedValue([]) })),
  useConnections: vi.fn(() => ({
    connections: vue.ref({
      instagram: { connected: false },
      google: { connected: false, emailAddress: null, identificationId: null },
    }),
    isLoading: vue.ref(false),
    loadError: vue.ref(null),
    actionError: vue.ref(null),
    importResult: vue.ref(null),
    fetchConnections: vi.fn().mockResolvedValue(undefined),
    startInstagramConnect: vi.fn(),
    disconnectInstagram: vi.fn().mockResolvedValue(true),
    disconnectGoogle: vi.fn().mockResolvedValue(true),
    importInstagramPhotos: vi.fn().mockResolvedValue(true),
  })),
  useAccountActions: vi.fn(() => ({
    isLoading: vue.readonly(vue.ref(false)),
    passwordError: vue.readonly(vue.ref(null)),
    avatarError: vue.readonly(vue.ref(null)),
    deleteError: vue.readonly(vue.ref(null)),
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
