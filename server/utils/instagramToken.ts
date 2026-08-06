/**
 * Instagram long-lived token lifecycle: expiry checks, refresh + persistence,
 * and the on-use "self-heal" path.
 *
 * Instagram long-lived tokens last 60 days and are silently useless once they
 * lapse. This module keeps a stored token fresh: it decides when a token is
 * close enough to expiry to refresh, exchanges it via the Instagram Graph
 * refresh endpoint, and writes the new token + expiry back to
 * `connected_accounts`.
 *
 * Isolated from the Nitro request context (no getDb()/useRuntimeConfig() call
 * here — the caller passes the db in) so it can be unit tested against a plain
 * mocked db chain, with the Instagram client and token crypto mocked at their
 * module boundaries.
 */
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/index";
import { connectedAccounts, CONNECTED_ACCOUNT_PROVIDER } from "../db/schema";
import {
  refreshLongLivedToken,
  type InstagramLongLivedTokenResponse,
} from "./instagramClient";
import { decryptToken, encryptToken } from "./tokenCrypto";
import { MS_PER_DAY } from "./accountLifecycle";

export type InstagramTokenDb = ReturnType<typeof createDb>;

// Refresh once a token is within this many days of its 60-day expiry. Wide
// enough that an account syncing even monthly is always renewed before it
// lapses, while avoiding a refresh on every single import.
export const INSTAGRAM_REFRESH_THRESHOLD_DAYS = 10;

export interface StoredInstagramToken {
  // Ciphertext as stored in connected_accounts.accessToken.
  accessToken: string;
  expiresAt: Date | null;
}

/**
 * True when a token should be refreshed now: it expires within the threshold
 * window. A null expiry (a row connected before expiry was persisted) counts
 * as near-expiry so the next use backfills a real expiry by refreshing.
 */
export function isInstagramTokenNearExpiry(
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (!expiresAt) {
    return true;
  }
  const remainingMs = expiresAt.getTime() - now.getTime();
  return remainingMs < INSTAGRAM_REFRESH_THRESHOLD_DAYS * MS_PER_DAY;
}

/**
 * True only when a token's expiry is known and already past. A null expiry is
 * treated as not-yet-expired: we can't prove it's dead, so the caller should
 * still attempt to use it rather than hard-fail.
 */
export function isInstagramTokenExpired(
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (!expiresAt) {
    return false;
  }
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Absolute expiry for a freshly refreshed token, derived from the API's
 * `expires_in` (seconds from now).
 */
export function expiryFromResponse(
  response: InstagramLongLivedTokenResponse,
  now: Date,
): Date {
  return new Date(now.getTime() + response.expires_in * 1000);
}

/**
 * Writes a refreshed token + its new expiry to the user's Instagram row.
 * Shared by the on-use path and the scheduled batch job so both persist
 * identically.
 */
export async function persistRefreshedInstagramToken(
  db: InstagramTokenDb,
  userId: string,
  response: InstagramLongLivedTokenResponse,
  now: Date,
): Promise<Date> {
  const expiresAt = expiryFromResponse(response, now);
  await db
    .update(connectedAccounts)
    .set({
      accessToken: encryptToken(response.access_token),
      expiresAt,
    })
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM),
      ),
    );
  return expiresAt;
}

/**
 * Returns a usable plaintext Instagram token for the user, refreshing and
 * persisting first when the stored token is near expiry.
 *
 * Failure handling: if the refresh call fails but the current token has not
 * yet expired, we fall back to the current token (the next run retries the
 * refresh) rather than blocking the import. If the current token is already
 * expired, the refresh failure is fatal and re-thrown — calling Instagram with
 * a dead token would only fail later and more opaquely.
 */
export async function ensureFreshInstagramToken(
  db: InstagramTokenDb,
  userId: string,
  stored: StoredInstagramToken,
  now: Date = new Date(),
): Promise<string> {
  const currentToken = decryptToken(stored.accessToken);
  if (!isInstagramTokenNearExpiry(stored.expiresAt, now)) {
    return currentToken;
  }

  try {
    const refreshed = await refreshLongLivedToken({
      accessToken: currentToken,
    });
    await persistRefreshedInstagramToken(db, userId, refreshed, now);
    return refreshed.access_token;
  } catch (error) {
    if (isInstagramTokenExpired(stored.expiresAt, now)) {
      throw error;
    }
    return currentToken;
  }
}
