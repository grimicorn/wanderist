import type { H3Event } from "h3";
import { verifyToken } from "@clerk/backend";

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
  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }
  try {
    // @clerk/backend exports verifyToken as a standalone function, not a
    // method on the client returned by createClerkClient() (that client only
    // exposes resource APIs like `users`, `sessions`, etc.).
    const { sub } = await verifyToken(token, { secretKey });
    return sub;
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
