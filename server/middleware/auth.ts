import { createClerkClient } from "@clerk/backend";
import type { H3Event } from "h3";

const UNPROTECTED_PREFIXES = ["/api/_"];

function isProtectedRoute(path: string): boolean {
  return (
    path.startsWith("/api/") &&
    !UNPROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function extractBearerToken(event: H3Event): string | undefined {
  return getRequestHeader(event, "authorization")?.replace("Bearer ", "");
}

async function verifyClerkToken(token: string): Promise<string> {
  const clerkClient = createClerkClient({
    secretKey: process.env.NUXT_CLERK_SECRET_KEY,
  });
  const session = await clerkClient.sessions.verifySession(token, token);
  return session.userId;
}

export default defineEventHandler(async (event) => {
  if (!isProtectedRoute(getRequestURL(event).pathname)) return;

  const token = extractBearerToken(event);
  if (!token) throw createError({ statusCode: 401, message: "Unauthorized" });

  try {
    event.context.auth = { userId: await verifyClerkToken(token) };
  } catch {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
});
