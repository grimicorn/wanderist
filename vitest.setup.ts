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
  useRuntimeConfig: vi.fn(() => ({ public: {} })),
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
  // Nuxt auto-import for useApiClient composable (used by trips store)
  useApiClient: vi.fn(() => ({ apiFetch: vi.fn().mockResolvedValue([]) })),
});
