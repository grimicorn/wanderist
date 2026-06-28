import type { H3Event } from "h3";
import { getClerkClient } from "../utils/clerk";

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
  const clerkClient = getClerkClient();
  try {
    const { sub } = await clerkClient.verifyToken(token);
    return sub;
  } catch {
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
