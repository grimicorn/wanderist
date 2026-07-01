import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// .env.e2e holds e2e-only overrides (E2E_DATABASE_URL); .env supplies the Clerk
// keys the authenticated-flow tests need. Load the specific file first so its
// values win — dotenv does not override already-set vars.
dotenv.config({ path: ".env.e2e" });
dotenv.config({ path: ".env" });

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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
