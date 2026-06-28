/**
 * Isolated Instagram Graph API client.
 *
 * All Instagram API calls go through this module so handlers stay thin and
 * tests can mock the network without touching the real endpoint.
 *
 * NOTE: Instagram's Basic Display API was deprecated in December 2024.
 * This implementation targets the Instagram Graph API, which requires a
 * Facebook App connected to a Business or Creator Instagram account. Users
 * must grant the `instagram_basic`, `instagram_manage_insights`, and
 * `pages_show_list` permissions during OAuth.
 */

export const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com";
export const INSTAGRAM_OAUTH_AUTHORIZE_URL =
  "https://api.instagram.com/oauth/authorize";
export const INSTAGRAM_OAUTH_TOKEN_URL =
  "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_LONG_LIVED_TOKEN_URL =
  "https://graph.instagram.com/access_token";

export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_media",
].join(",");

export const INSTAGRAM_MEDIA_FIELDS =
  "id,caption,media_type,timestamp,permalink,location";

export const INSTAGRAM_MEDIA_LIMIT = 50;

// Only image types can carry location metadata.
export const INSTAGRAM_GEOTAGGED_MEDIA_TYPES = new Set([
  "IMAGE",
  "CAROUSEL_ALBUM",
]);

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface InstagramUserResponse {
  id: string;
  username?: string;
}

export interface InstagramMediaLocation {
  name: string;
  latitude?: number;
  longitude?: number;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  timestamp: string;
  permalink: string;
  location?: InstagramMediaLocation;
}

export interface InstagramMediaResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

/**
 * Builds the Instagram OAuth authorization URL to redirect the user to.
 */
export function buildInstagramAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state: params.state,
  });
  return `${INSTAGRAM_OAUTH_AUTHORIZE_URL}?${query.toString()}`;
}

/**
 * Exchanges an authorization code for a short-lived access token.
 */
export async function exchangeInstagramCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<InstagramTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const response = await fetch(INSTAGRAM_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Instagram token exchange failed (${response.status}): ${text}`,
    );
  }

  return response.json() as Promise<InstagramTokenResponse>;
}

/**
 * Exchanges a short-lived token for a long-lived token (60-day expiry).
 */
export async function exchangeForLongLivedToken(params: {
  clientSecret: string;
  shortLivedToken: string;
}): Promise<InstagramLongLivedTokenResponse> {
  const query = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: params.clientSecret,
    access_token: params.shortLivedToken,
  });

  const response = await fetch(
    `${INSTAGRAM_LONG_LIVED_TOKEN_URL}?${query.toString()}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Instagram long-lived token exchange failed (${response.status}): ${text}`,
    );
  }

  return response.json() as Promise<InstagramLongLivedTokenResponse>;
}

/**
 * Fetches the authenticated Instagram user's profile (id + username).
 */
export async function fetchInstagramUser(
  accessToken: string,
): Promise<InstagramUserResponse> {
  const query = new URLSearchParams({
    fields: "id,username",
    access_token: accessToken,
  });

  const response = await fetch(
    `${INSTAGRAM_GRAPH_BASE_URL}/me?${query.toString()}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Instagram user fetch failed (${response.status}): ${text}`,
    );
  }

  return response.json() as Promise<InstagramUserResponse>;
}

/**
 * Fetches recent media for the authenticated user.
 */
export async function fetchInstagramMedia(
  accessToken: string,
): Promise<InstagramMediaResponse> {
  const query = new URLSearchParams({
    fields: INSTAGRAM_MEDIA_FIELDS,
    limit: String(INSTAGRAM_MEDIA_LIMIT),
    access_token: accessToken,
  });

  const response = await fetch(
    `${INSTAGRAM_GRAPH_BASE_URL}/me/media?${query.toString()}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Instagram media fetch failed (${response.status}): ${text}`,
    );
  }

  return response.json() as Promise<InstagramMediaResponse>;
}

/**
 * Filters a list of media items to only those with geotag data.
 */
export function filterGeotaggedMedia(
  items: InstagramMediaItem[],
): InstagramMediaItem[] {
  return items.filter(
    (item) =>
      INSTAGRAM_GEOTAGGED_MEDIA_TYPES.has(item.media_type) &&
      item.location !== undefined,
  );
}
