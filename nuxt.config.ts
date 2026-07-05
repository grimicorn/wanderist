import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  future: { compatibilityVersion: 4 },
  modules: ["@clerk/nuxt", "@sentry/nuxt/module", "@pinia/nuxt"],
  sourcemap: { client: "hidden" },
  sentry: {
    sourceMapsUploadOptions: {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },
  clerk: {
    skipServerMiddleware: true,
  },
  runtimeConfig: {
    databaseUrl: process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || "",
    // Set to "true" to block new-user provisioning (invite-only). Read via
    // runtimeConfig so the value bakes into the server bundle at build time and
    // survives into the deployed Netlify function.
    disableSignups: process.env.NUXT_DISABLE_SIGNUPS || "",
    public: {
      sentryDsn: "",
      siteOrigin: "",
      mapboxToken: "",
    },
  },
  css: ["~/assets/css/main.css", "mapbox-gl/dist/mapbox-gl.css"],
  devtools: { enabled: true },
  nitro: {
    preset: "netlify",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
