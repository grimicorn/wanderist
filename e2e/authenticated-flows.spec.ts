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
 *   - NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY and NUXT_CLERK_SECRET_KEY must be set.
 *     Locally they come from .env (playwright.config.ts loads it); CI injects
 *     them as job env. clerkSetup uses them to fetch a backend testing token.
 *   - A Clerk user matching CLERK_TEST_EMAIL (below) must exist in the dev
 *     instance. Its +clerk_test suffix lets @clerk/testing auto-verify the OTP
 *     (424242) without sending real email — create the account once via /login.
 *
 * Tests are skipped automatically when the Clerk keys are absent, so a CI run
 * without credentials degrades gracefully rather than erroring.
 */
import { test, expect, type TestInfo } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

// Fixed Clerk test identifier — no env var needed. The +clerk_test suffix marks
// it a Clerk test address, so @clerk/testing signs in with the fixed OTP 424242
// and no real email is sent. The matching user must exist in the dev instance
// (create it once via /login); the domain is irrelevant since delivery is bypassed.
const CLERK_TEST_EMAIL = "wanderist+clerk_test@example.com";

// clerkSetup needs the dev instance's Clerk keys, passed explicitly because
// @clerk/testing reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY, not the
// NUXT_-prefixed names the app uses.
const publishableKey = process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.NUXT_CLERK_SECRET_KEY;

function hasClerkCredentials(): boolean {
  return Boolean(publishableKey && secretKey);
}

// ---------------------------------------------------------------------------
// Global setup — fetches a testing token from Clerk's Backend API once.
// Skipped when the Clerk keys are absent so the suite does not error on CI.
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  if (!hasClerkCredentials()) {
    return;
  }
  await clerkSetup({ publishableKey, secretKey });
});

// ---------------------------------------------------------------------------
// Guard: skip individual tests when the Clerk keys are absent.
// ---------------------------------------------------------------------------

test.beforeEach(async ({}, testInfo) => {
  if (!hasClerkCredentials()) {
    testInfo.skip(
      true,
      "Clerk keys are not set — add NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY and NUXT_CLERK_SECRET_KEY to .env to run authenticated flows",
    );
  }
});

// ---------------------------------------------------------------------------
// Helper: sign in with the Clerk testing helper using the email_code strategy.
// The +clerk_test suffix lets @clerk/testing auto-fill the OTP in dev mode.
// ---------------------------------------------------------------------------

async function signIn(page: Parameters<typeof clerk.signIn>[0]["page"]) {
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: CLERK_TEST_EMAIL,
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
// Helper: wait for the app shell to be genuinely interactive.
//
// Clerk's Nuxt module runs with skipServerMiddleware: true, so auth resolves
// client-side only: the app/layouts/app.vue shell (and its click handlers,
// e.g. the compose bar) paints from SSR markup before Clerk finishes loading
// and hydration attaches listeners. A click that lands in that window is
// accepted by the DOM but silently dropped, since Vue has not bound the
// handler yet. app/layouts/app.vue exposes `data-auth-ready` once Clerk's
// `isLoaded` is true; waiting on it here avoids racing on paint.
// ---------------------------------------------------------------------------

async function waitForAppReady(
  page: Parameters<typeof clerk.signIn>[0]["page"],
) {
  await page.locator('.shell[data-auth-ready="true"]').waitFor({
    state: "attached",
    timeout: 15_000,
  });
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
  await waitForAppReady(page);

  // Open the new-entry drawer via the compose bar.
  await page.locator(".compose").click();

  // The entry drawer should open.
  await expect(page.locator(".new-entry")).toBeVisible({ timeout: 5_000 });

  // Fill in the entry title. The field's placeholder is descriptive rather
  // than literally "title" ("Give this moment a name…"); the field wrapper
  // directly under the "Title" label is the first field__wrap in the drawer.
  const titleInput = page
    .locator(".new-entry .field__wrap input.field__input")
    .first();
  await titleInput.fill(entryTitle);

  // Submit the form. The drawer's actions are plain buttons (no <form>/
  // type="submit"), so target the "publish" button by its label instead.
  await page.locator(".new-entry button", { hasText: "publish" }).click();

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
  await waitForAppReady(page);

  // Click the plan-a-new-route button.
  await page.locator("button", { hasText: "plan a new route" }).click();

  // Fill in the trip name in the modal/drawer.
  const nameInput = page.locator("input[placeholder*='trip name' i]").first();
  await nameInput.fill(tripName);
  await page.locator("button[type='submit']").click();

  // After creation, the trip should appear in the list.
  await expect(page.locator(".tcard__name", { hasText: tripName })).toBeVisible(
    {
      timeout: 10_000,
    },
  );

  // Click through to the trip detail page.
  await page.locator(".tcard__name", { hasText: tripName }).click();
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
