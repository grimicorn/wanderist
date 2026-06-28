/**
 * GET /api/connections/instagram
 *
 * Returns whether the authenticated user has a connected Instagram account.
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

  const rows = await database
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM),
      ),
    )
    .limit(1);

  return { connected: rows.length > 0 };
});
