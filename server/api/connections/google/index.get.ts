/**
 * GET /api/connections/google
 *
 * Returns the authenticated user's Google connection state by reading Clerk's
 * external accounts. No database row is maintained for Google; Clerk is the
 * source of truth.
 */

import { requireUser } from "../../../utils/auth";
import { getClerkClient } from "../../../utils/clerk";
import { fetchGoogleConnectionInfo } from "../../../utils/googleClient";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const clerkClient = getClerkClient();
  const info = await fetchGoogleConnectionInfo(clerkClient, userId);
  return info;
});
