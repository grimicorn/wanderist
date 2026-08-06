/**
 * Scheduled Netlify Function: refreshes Instagram long-lived tokens nearing
 * their 60-day expiry (server/db/schema.ts connectedAccounts.expiresAt). See
 * server/utils/refreshInstagramTokens.ts for the actual query and refresh
 * loop — this file is a thin adapter that wires that logic to a real DB
 * connection and to Netlify's scheduled-function invocation.
 *
 * Deliberately lives outside server/ and is bundled independently by Netlify
 * (not by Nitro), mirroring purge-deleted-accounts.mts: Nitro's netlify preset
 * bundles server/api/** into a single request-driven function with no facility
 * for a cron-scheduled invocation. netlify/functions/ is Netlify's own,
 * separate functions directory, wired to a schedule via netlify.toml
 * ([functions."refresh-instagram-tokens"].schedule).
 *
 * Because this file is not part of the Nitro bundle, it cannot use
 * useRuntimeConfig() or any other Nitro auto-import — it reads DATABASE_URL
 * directly from process.env via createDb().
 *
 * Per-account refresh failures (a token already dead, a user who revoked
 * access) are expected and non-fatal: they are collected into the result and
 * logged, and the run still succeeds. Only an unexpected error (e.g. the DB
 * query itself throwing) is re-thrown so Netlify's run history records the
 * invocation as failed — mirroring purge-deleted-accounts.mts.
 */
import { createDb } from "../../server/db/index";
import { refreshExpiringInstagramTokens } from "../../server/utils/refreshInstagramTokens";

export const handler = async () => {
  try {
    const db = createDb(process.env.DATABASE_URL ?? "");
    const result = await refreshExpiringInstagramTokens(db);

    console.log(
      `refresh-instagram-tokens: refreshed ${result.refreshedCount} token(s)`,
      result.refreshedUserIds,
    );
    if (result.failures.length > 0) {
      console.warn(
        `refresh-instagram-tokens: ${result.failures.length} token(s) failed to refresh`,
        result.failures,
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("refresh-instagram-tokens: refresh run failed", error);
    throw error;
  }
};
