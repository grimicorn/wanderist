/**
 * GET /api/connections/instagram/callback
 *
 * Handles the Instagram OAuth redirect. Exchanges the code for tokens, fetches
 * the Instagram user ID, stores the encrypted long-lived token in
 * `connected_accounts`, and redirects the user to /settings#connections.
 */

import { eq, and } from "drizzle-orm";
import { ensureUser } from "../../../utils/auth";
import { getDb } from "../../../db/index";
import {
  connectedAccounts,
  CONNECTED_ACCOUNT_PROVIDER,
} from "../../../db/schema";
import {
  exchangeInstagramCode,
  exchangeForLongLivedToken,
  fetchInstagramUser,
} from "../../../utils/instagramClient";
import { encryptToken } from "../../../utils/tokenCrypto";

const STATE_COOKIE_NAME = "ig_oauth_state";
const SETTINGS_REDIRECT_PATH = "/settings#connections";
const ERROR_REDIRECT_PATH = "/settings#connections?connection_error=instagram";

function buildRedirectUri(origin: string): string {
  return `${origin}/api/connections/instagram/callback`;
}

function readInstagramConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.INSTAGRAM_CLIENT_ID ?? "";
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET ?? "";
  const appOrigin = process.env.NUXT_PUBLIC_SITE_ORIGIN ?? "";

  if (!clientId || !clientSecret || !appOrigin) {
    throw createError({
      statusCode: 500,
      statusMessage: "Instagram OAuth is not configured",
    });
  }

  return { clientId, clientSecret, redirectUri: buildRedirectUri(appOrigin) };
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);

  const query = getQuery(event);
  const code = query.code as string | undefined;
  const returnedState = query.state as string | undefined;
  const oauthError = query.error as string | undefined;

  // User denied the authorization.
  if (oauthError) {
    deleteCookie(event, STATE_COOKIE_NAME);
    return sendRedirect(event, ERROR_REDIRECT_PATH, 302);
  }

  if (!code || !returnedState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing code or state",
    });
  }

  const storedState = getCookie(event, STATE_COOKIE_NAME);
  deleteCookie(event, STATE_COOKIE_NAME);

  if (!storedState || storedState !== returnedState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state",
    });
  }

  const { clientId, clientSecret, redirectUri } = readInstagramConfig();

  const shortLivedTokenResponse = await exchangeInstagramCode({
    clientId,
    clientSecret,
    redirectUri,
    code,
  });

  const longLivedTokenResponse = await exchangeForLongLivedToken({
    clientSecret,
    shortLivedToken: shortLivedTokenResponse.access_token,
  });

  const instagramUser = await fetchInstagramUser(
    longLivedTokenResponse.access_token,
  );

  const encryptedToken = encryptToken(longLivedTokenResponse.access_token);
  const database = getDb();

  await database
    .insert(connectedAccounts)
    .values({
      id: crypto.randomUUID(),
      userId,
      provider: CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM,
      externalId: instagramUser.id,
      accessToken: encryptedToken,
    })
    .onConflictDoUpdate({
      target: [connectedAccounts.provider, connectedAccounts.externalId],
      set: {
        userId,
        accessToken: encryptedToken,
        connectedAt: new Date(),
      },
    });

  // Also handle the case where the same user already has a different
  // Instagram account connected (provider + userId combination).
  // The unique constraint is on (provider, externalId); upsert covers re-auth.

  return sendRedirect(event, SETTINGS_REDIRECT_PATH, 302);
});
