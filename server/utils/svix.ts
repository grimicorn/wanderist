import { Webhook } from "svix";

// Svix header names used for webhook signature verification.
export const SVIX_ID_HEADER = "svix-id";
export const SVIX_TIMESTAMP_HEADER = "svix-timestamp";
export const SVIX_SIGNATURE_HEADER = "svix-signature";

export interface SvixHeaders {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
}

/**
 * Verifies a Svix webhook signature and returns the parsed payload.
 * Throws if the signature is invalid or headers are missing.
 * Isolated here so callers can stub this seam in tests without network access.
 */
export function verifySvixSignature<T = unknown>(
  rawBody: string,
  svixHeaders: SvixHeaders,
  secret: string,
): T {
  const webhook = new Webhook(secret);
  return webhook.verify(rawBody, svixHeaders) as T;
}
