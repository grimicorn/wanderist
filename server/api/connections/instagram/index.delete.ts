/**
 * DELETE /api/connections/instagram
 *
 * Disconnects the authenticated user's Instagram account by removing the
 * row from `connected_accounts`. The stored token is discarded.
 */

import { eq, and } from "drizzle-orm";
import { requireUser } from "../../../utils/auth";
import { getDb } from "../../../db/index";
import {
  connectedAccounts,
  CONNECTED_ACCOUNT_PROVIDER,
} from "../../../db/schema";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const database = getDb();

  await database
    .delete(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM),
      ),
    );

  return { ok: true };
});
