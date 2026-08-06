/**
 * Batch refresh of Instagram long-lived tokens for the scheduled job
 * (netlify/functions/refresh-instagram-tokens.mts).
 *
 * The on-use path (server/utils/instagramToken.ts ensureFreshInstagramToken)
 * only refreshes a token when its owner actually imports. Accounts that go
 * quiet for 60 days would still lapse silently — this job closes that gap by
 * refreshing every Instagram token nearing expiry on a schedule.
 *
 * Isolated from both the Nitro request context and the Netlify Functions
 * runtime (the caller passes the db in) so it can be unit tested against a
 * plain mocked db chain, with the Instagram client and token crypto mocked at
 * their module boundaries — the same pattern as server/utils/purgeAccounts.ts.
 */
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { createDb } from "../db/index";
import { connectedAccounts, CONNECTED_ACCOUNT_PROVIDER } from "../db/schema";
import { refreshLongLivedToken } from "./instagramClient";
import { decryptToken } from "./tokenCrypto";
import {
  INSTAGRAM_REFRESH_THRESHOLD_DAYS,
  persistRefreshedInstagramToken,
  type InstagramTokenDb,
} from "./instagramToken";
import { MS_PER_DAY } from "./accountLifecycle";

export interface InstagramRefreshFailure {
  userId: string;
  error: string;
}

export interface InstagramRefreshResult {
  refreshedUserIds: string[];
  refreshedCount: number;
  failures: InstagramRefreshFailure[];
}

/**
 * The instant a token must expire before to be considered "due" for a
 * scheduled refresh: within INSTAGRAM_REFRESH_THRESHOLD_DAYS of now.
 */
function refreshCutoff(now: Date): Date {
  return new Date(
    now.getTime() + INSTAGRAM_REFRESH_THRESHOLD_DAYS * MS_PER_DAY,
  );
}

async function refreshOne(
  db: InstagramTokenDb,
  account: { userId: string; accessToken: string },
  now: Date,
): Promise<void> {
  const currentToken = decryptToken(account.accessToken);
  const refreshed = await refreshLongLivedToken({ accessToken: currentToken });
  await persistRefreshedInstagramToken(db, account.userId, refreshed, now);
}

/**
 * Refreshes every Instagram token due for renewal (expired-unknown/null or
 * within the threshold window). One account's failure never aborts the batch:
 * failures are collected and returned so the caller can surface partial
 * results rather than swallowing them.
 */
export async function refreshExpiringInstagramTokens(
  db: InstagramTokenDb,
  now: Date = new Date(),
): Promise<InstagramRefreshResult> {
  const cutoff = refreshCutoff(now);

  const dueAccounts = await db
    .select({
      userId: connectedAccounts.userId,
      accessToken: connectedAccounts.accessToken,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.provider, CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM),
        or(
          isNull(connectedAccounts.expiresAt),
          lt(connectedAccounts.expiresAt, cutoff),
        ),
      ),
    );

  const refreshedUserIds: string[] = [];
  const failures: InstagramRefreshFailure[] = [];

  for (const account of dueAccounts) {
    if (!account.accessToken) {
      failures.push({ userId: account.userId, error: "No stored token" });
      continue;
    }
    try {
      await refreshOne(
        db,
        { userId: account.userId, accessToken: account.accessToken },
        now,
      );
      refreshedUserIds.push(account.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failures.push({ userId: account.userId, error: message });
    }
  }

  return {
    refreshedUserIds,
    refreshedCount: refreshedUserIds.length,
    failures,
  };
}
