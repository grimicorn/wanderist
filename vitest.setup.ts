import * as vue from 'vue'
import { vi } from 'vitest'

// Expose Vue composition API as globals to match Nuxt's auto-import behavior
Object.assign(globalThis, vue)

// Stub Nuxt-only composables that are unavailable in plain Vitest
Object.assign(globalThis, {
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
  useRoute: vi.fn(() => ({ params: {}, query: {} })),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  navigateTo: vi.fn(),
  useState: <T>(key: string, init?: () => T) => vue.ref(init?.()),
  useId: (() => { let n = 0; return () => `test-id-${++n}` })(),
  useNuxtApp: vi.fn(() => ({})),
  useRuntimeConfig: vi.fn(() => ({ public: {} })),
  useScrollReveal: vi.fn(),
  // Clerk composables
  useClerkAuth: vi.fn(() => ({ isSignedIn: vue.ref(false), isLoaded: vue.ref(true) })),
  useClerkUser: vi.fn(() => ({ user: vue.ref(null) })),
  // Pinia
  defineStore: vi.fn(),
})
