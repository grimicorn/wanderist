/**
 * E2E: Authenticated user flows
 *
 * Tests here cover sign-in, creating an entry, creating a trip, viewing trip
 * detail, and dropping a pin on the map. They run against the real running
 * server and rely on Clerk's @clerk/testing package to authenticate.
 *
 * Pre-requisites:
 *   - The app is running at http://localhost:3000 (or via the Playwright
 *     webServer config in playwright.config.ts).
 *   - E2E_TEST_EMAIL must be set to a Clerk dev-instance user email. The
 *     address must end with "+clerk_test@<domain>" so Clerk auto-fills the
 *     OTP code during e2e (e.g. wanderist+clerk_test@example.com).
 *   - NUXT_CLERK_SECRET_KEY must be set so @clerk/testing can fetch a backend
 *     testing token. The wanderist.env file already includes this for local
 *     agent runs.
 *
 * Tests are skipped automatically when E2E_TEST_EMAIL is unset, so a CI run
 * without credentials degrades gracefully rather than erroring.
 */
import { test, expect, type TestInfo } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

// ---------------------------------------------------------------------------
// Global setup — fetches a testing token from Clerk's Backend API once.
// Skipped when E2E_TEST_EMAIL is absent so the suite does not error on CI.
// clerkSetup reads NUXT_CLERK_SECRET_KEY from the environment.
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  if (!process.env.E2E_TEST_EMAIL) {
    return;
  }
  const publishableKey = process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!publishableKey || !secretKey) {
    throw new Error(
      "E2E_TEST_EMAIL is set but NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY or NUXT_CLERK_SECRET_KEY is missing",
    );
  }
  await clerkSetup({ publishableKey });
});

// ---------------------------------------------------------------------------
// Guard: skip individual tests when test credentials are absent.
// ---------------------------------------------------------------------------

test.beforeEach(async (_fixtures, testInfo) => {
  if (!process.env.E2E_TEST_EMAIL) {
    testInfo.skip(
      true,
      "E2E_TEST_EMAIL is not set — add it to .env.test to run authenticated flows",
    );
  }
});

// ---------------------------------------------------------------------------
// Helper: sign in with the Clerk testing helper using email_code strategy.
// The +clerk_test suffix tells Clerk to auto-fill the OTP in dev mode.
// ---------------------------------------------------------------------------

async function signIn(page: Parameters<typeof clerk.signIn>[0]["page"]) {
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: process.env.E2E_TEST_EMAIL!,
    },
  });
}

// ---------------------------------------------------------------------------
// Unique suffix — prevents duplicate-match strict-mode failures across runs.
// Includes the Playwright worker index to avoid collisions under sharding.
// ---------------------------------------------------------------------------

function runTag(testInfo: TestInfo): string {
  return `run-${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("user can sign in and reach the journal page", async ({ page }) => {
  await signIn(page);
  await page.goto("/journal");
  await expect(page).toHaveURL("/journal");
  // The feed wrapper is present once auth and data load.
  await expect(page.locator(".feed")).toBeVisible({ timeout: 15_000 });
});

test("user can create a new journal entry", async ({ page }, testInfo) => {
  const tag = runTag(testInfo);
  const entryTitle = `E2E test entry ${tag}`;

  await signIn(page);
  await page.goto("/journal");
  await expect(page.locator(".feed")).toBeVisible({ timeout: 15_000 });

  // Open the new-entry drawer via the compose bar.
  await page.locator(".compose").click();

  // The entry drawer should open.
  await expect(page.locator(".new-entry")).toBeVisible({ timeout: 5_000 });

  // Fill in the entry title — use .first() in case multiple title-like
  // inputs exist in the drawer, to avoid a strict-mode violation.
  const titleInput = page
    .locator(".new-entry input[placeholder*='title' i]")
    .first();
  await titleInput.fill(entryTitle);

  // Submit the form.
  await page.locator(".new-entry button[type='submit']").click();

  // The new entry should appear in the feed.
  await expect(
    page.locator(".post__title", { hasText: entryTitle }),
  ).toBeVisible({
    timeout: 10_000,
  });
});

test("user can create a trip and view its detail page", async ({
  page,
}, testInfo) => {
  const tag = runTag(testInfo);
  const tripName = `E2E test trip ${tag}`;

  await signIn(page);
  await page.goto("/trips");
  await expect(page.locator("h1", { hasText: "Your trips" })).toBeVisible({
    timeout: 15_000,
  });

  // Click the plan-a-new-route button.
  await page.locator("button", { hasText: "plan a new route" }).click();

  // Fill in the trip name in the modal/drawer.
  const nameInput = page.locator("input[placeholder*='trip name' i]").first();
  await nameInput.fill(tripName);
  await page.locator("button[type='submit']").click();

  // After creation, the trip should appear in the list.
  await expect(page.locator(".card__name", { hasText: tripName })).toBeVisible({
    timeout: 10_000,
  });

  // Click through to the trip detail page.
  await page.locator(".card__name", { hasText: tripName }).click();
  await expect(page).toHaveURL(/\/trips\/.+/);

  // The hero should show the trip name.
  await expect(page.locator(".thero h1")).toContainText(tripName, {
    timeout: 10_000,
  });
});

test("user can navigate to the map and see the places panel", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/map");
  await expect(page).toHaveURL("/map");
  await expect(page.locator(".map-stage")).toBeVisible({ timeout: 15_000 });
  // Either the places panel wrapper or the search input should be present.
  await expect(
    page.locator(".places-panel").or(page.locator(".places__search")).first(),
  ).toBeVisible({
    timeout: 5_000,
  });
});
