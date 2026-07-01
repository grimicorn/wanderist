import type { H3Event } from "h3";
import { requireClerkSecretKey, verifyClerkToken } from "../utils/clerk";

const API_PATH_PREFIX = "/api/";
const WEBHOOK_PATH_PREFIX = "/api/webhooks/";

function isApiPath(path: string): boolean {
  return path.startsWith(API_PATH_PREFIX);
}

function isWebhookPath(path: string): boolean {
  return path.startsWith(WEBHOOK_PATH_PREFIX);
}

function extractBearerToken(event: H3Event): string | null {
  const token = getHeader(event, "authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return token ?? null;
}

async function verifyBearerToken(event: H3Event): Promise<string> {
  const token = extractBearerToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  // Resolved outside the try below so a missing/misconfigured secret key
  // surfaces as a 500 (server misconfiguration), not a 401 (invalid token).
  const secretKey = requireClerkSecretKey();
  try {
    return await verifyClerkToken(token, secretKey);
  } catch (error) {
    console.error("verifyBearerToken: token verification failed", error);
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
}

export default defineEventHandler(async (event) => {
  if (!isApiPath(event.path)) {
    return;
  }

  // Webhook routes authenticate via Svix signature, not a bearer token.
  if (isWebhookPath(event.path)) {
    return;
  }

  event.context.userId = await verifyBearerToken(event);
});
