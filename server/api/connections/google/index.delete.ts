/**
 * DELETE /api/connections/google
 *
 * Disconnects Google from the user's Clerk account. Expects the request body:
 *   { identificationId: string }
 *
 * The identificationId is the value returned by GET /api/connections/google
 * as `identificationId`. It is passed back by the client to avoid a redundant
 * GET call in the handler — though the handler re-fetches to validate ownership
 * before proceeding.
 */

import { requireUser } from "../../../utils/auth";
import { getClerkClient } from "../../../utils/clerk";
import {
  fetchGoogleConnectionInfo,
  disconnectGoogleAccount,
} from "../../../utils/googleClient";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const body = await readBody(event);
  const identificationId = body?.identificationId;

  if (typeof identificationId !== "string" || identificationId.trim() === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "identificationId is required",
    });
  }

  // Re-fetch to confirm the account still belongs to this user before deleting.
  const clerkClient = getClerkClient();
  const info = await fetchGoogleConnectionInfo(clerkClient, userId);

  if (!info.connected || info.identificationId !== identificationId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Google account not found for this user",
    });
  }

  const secretKey = process.env.NUXT_CLERK_SECRET_KEY ?? "";
  if (!secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Clerk secret key is not configured",
    });
  }

  await disconnectGoogleAccount(secretKey, userId, identificationId);

  return { ok: true };
});
