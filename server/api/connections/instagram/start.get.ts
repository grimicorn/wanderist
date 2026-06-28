/**
 * GET /api/connections/instagram/start
 *
 * Redirects the authenticated user to Instagram's OAuth authorization page.
 * A CSRF state token is generated and stored in a short-lived cookie for the
 * callback handler to verify.
 */

import { requireUser } from "../../../utils/auth";
import { buildInstagramAuthUrl } from "../../../utils/instagramClient";

const STATE_COOKIE_NAME = "ig_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

function buildRedirectUri(origin: string): string {
  return `${origin}/api/connections/instagram/callback`;
}

function readInstagramConfig(): { clientId: string; redirectUri: string } {
  const clientId = process.env.INSTAGRAM_CLIENT_ID ?? "";
  const appOrigin = process.env.NUXT_PUBLIC_SITE_ORIGIN ?? "";

  if (!clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: "Instagram OAuth is not configured",
    });
  }

  if (!appOrigin) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_PUBLIC_SITE_ORIGIN is not configured",
    });
  }

  return { clientId, redirectUri: buildRedirectUri(appOrigin) };
}

export default defineEventHandler(async (event) => {
  requireUser(event);

  const { clientId, redirectUri } = readInstagramConfig();
  const state = crypto.randomUUID();

  setCookie(event, STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  const authUrl = buildInstagramAuthUrl({ clientId, redirectUri, state });

  return sendRedirect(event, authUrl, 302);
});
