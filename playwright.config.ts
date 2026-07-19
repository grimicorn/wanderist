import { defineConfig, devices } from "@playwright/test";

// Env is injected by dotenvx before Playwright starts (see the "e2e" npm
// scripts: `dotenvx run -f .env.e2e -- playwright test`). In CI the workflow
// overrides E2E_DATABASE_URL with a fresh per-run Neon branch. The webServer
// runs the raw `dev:test` script (no dotenvx) so it inherits that already-
// decrypted env instead of re-reading the encrypted files.

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/artifacts",
  reporter: [["html", { outputFolder: "e2e/report" }]],
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Raw `nuxt dev` triggers Nuxt's built-in dotenv loader, which would inject
    // the encrypted .env's ciphertext for any var not already set by dotenvx.
    // An explicit empty DSN blocks that for Sentry and cleanly disables it in e2e.
    env: {
      NUXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
