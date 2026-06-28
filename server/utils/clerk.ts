import { createClerkClient } from "@clerk/backend";

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

/**
 * Returns a cached Clerk backend client.
 * Isolated here so middleware and API routes share one client instance
 * and the dependency can be mocked in tests.
 */
export function getClerkClient(): ReturnType<typeof createClerkClient> {
  if (cachedClerkClient) {
    return cachedClerkClient;
  }
  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }
  cachedClerkClient = createClerkClient({ secretKey });
  return cachedClerkClient;
}
