# Stores

Pinia stores live here. `@pinia/nuxt` auto-imports them — no manual imports needed.

## Convention

- One store per concern: `useUserStore`, `useRecordsStore`, etc.
- Use the **Setup store** syntax (preferred over Options API):

```ts
// app/stores/example.ts
export const useExampleStore = defineStore("example", () => {
  const count = ref(0);

  function increment() {
    count.value++;
  }

  return { count, increment };
});
```

- Access in components/pages:

```ts
const example = useExampleStore();
```

## Making authenticated API calls

Use `useApiClient()` from `app/composables/useApiClient.ts` to make calls to
`/api/*` routes. It automatically injects the Clerk session token as
`Authorization: Bearer` header, so you don't manage auth headers in store
code.

```ts
// app/stores/trips.ts
export const useTripsStore = defineStore("trips", () => {
  const { apiFetch } = useApiClient();
  const trips = ref([]);

  async function fetchTrips() {
    trips.value = await apiFetch("/api/trips");
  }

  return { trips, fetchTrips };
});
```

Do not use raw `$fetch` for `/api/*` routes from stores, components, or pages.
Always go through `apiFetch` so the token injection stays in one place.
