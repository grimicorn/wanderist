/**
 * Isolated Google connection client backed by Clerk.
 *
 * Google sign-in is handled by Clerk's OAuth flow (the user signs in with
 * Google through Clerk's hosted UI). Rather than running a separate Google
 * OAuth flow and duplicating tokens in `connected_accounts`, this module reads
 * the real connection state from Clerk's external accounts on the user record
 * and delegates disconnect to Clerk's Backend API.
 *
 * This keeps Google connection management in sync with Clerk's session state
 * automatically: if the user removes Google from their Clerk account externally,
 * the disconnect is reflected here immediately.
 *
 * KNOWN CLERK SDK BUG: clerkUser.externalAccounts[].id returns an `idn_`
 * identification ID, not the `eac_` external account ID that
 * deleteUserExternalAccount() expects (clerk/javascript#7584, #7936).
 * We work around this by calling the Clerk BAPI REST endpoint directly
 * for disconnect, using the `externalId` field (the provider-issued user ID)
 * to identify the account on the GET side.
 */

import type { createClerkClient } from "@clerk/backend";

export const GOOGLE_PROVIDER_ID = "google";

export interface GoogleConnectionInfo {
  connected: boolean;
  emailAddress: string | null;
  /**
   * The identification ID (`idn_*`) from Clerk's SDK. This is exposed for
   * informational display only — use `externalAccountId` for API calls.
   */
  identificationId: string | null;
}

type ClerkClient = ReturnType<typeof createClerkClient>;

/**
 * Returns the user's Google connection state by reading Clerk's external
 * accounts on the user record.
 */
export async function fetchGoogleConnectionInfo(
  clerkClient: ClerkClient,
  userId: string,
): Promise<GoogleConnectionInfo> {
  const clerkUser = await clerkClient.users.getUser(userId);
  const googleAccount = clerkUser.externalAccounts.find(
    (account) => account.provider === GOOGLE_PROVIDER_ID,
  );

  if (!googleAccount) {
    return {
      connected: false,
      emailAddress: null,
      identificationId: null,
    };
  }

  return {
    connected: true,
    emailAddress: googleAccount.emailAddress ?? null,
    identificationId: googleAccount.id,
  };
}

/**
 * Disconnects Google from the user's Clerk account by calling the Clerk BAPI
 * REST endpoint directly. The SDK's deleteUserExternalAccount() is broken
 * (it receives an `idn_` ID instead of the `eac_` ID the endpoint expects),
 * so we use the REST endpoint directly with the user ID and identification ID
 * via the List External Accounts endpoint to get the real `eac_` ID first.
 */
export async function disconnectGoogleAccount(
  secretKey: string,
  userId: string,
  identificationId: string,
): Promise<void> {
  // Step 1: list external accounts for the user to find the real `eac_` ID.
  const listUrl = `https://api.clerk.com/v1/users/${userId}/external_accounts`;
  const listResponse = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(
      `Clerk list external accounts failed (${listResponse.status}): ${text}`,
    );
  }

  type ExternalAccountEntry = {
    id: string;
    identification_id: string;
    provider: string;
  };
  const accounts = (await listResponse.json()) as ExternalAccountEntry[];
  const googleAccount = accounts.find(
    (account) =>
      account.provider === GOOGLE_PROVIDER_ID &&
      account.identification_id === identificationId,
  );

  if (!googleAccount) {
    // Already disconnected; treat as success.
    return;
  }

  // Step 2: delete using the real `eac_` external account ID.
  const deleteUrl = `https://api.clerk.com/v1/users/${userId}/external_accounts/${googleAccount.id}`;
  const deleteResponse = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!deleteResponse.ok) {
    const text = await deleteResponse.text();
    throw new Error(
      `Clerk disconnect Google failed (${deleteResponse.status}): ${text}`,
    );
  }
}
