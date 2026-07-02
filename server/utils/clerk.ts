import { createClerkClient, verifyToken } from "@clerk/backend";

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

export function requireClerkSecretKey(): string {
  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }
  return secretKey;
}

/**
 * Returns a cached Clerk backend client.
 * Isolated here so middleware and API routes share one client instance
 * and the dependency can be mocked in tests.
 */
export function getClerkClient(): ReturnType<typeof createClerkClient> {
  if (cachedClerkClient) {
    return cachedClerkClient;
  }
  cachedClerkClient = createClerkClient({ secretKey: requireClerkSecretKey() });
  return cachedClerkClient;
}

/**
 * Verifies a Clerk session token and returns the subject (user ID).
 *
 * @clerk/backend exports verifyToken as a standalone function, not a method
 * on the client returned by createClerkClient() (that client only exposes
 * resource APIs like `users`, `sessions`, etc.). Isolated here alongside
 * getClerkClient() so the Clerk dependency stays mockable at one boundary.
 *
 * Takes secretKey as a parameter (rather than resolving it internally) so a
 * missing/misconfigured key surfaces to the caller separately from an
 * actually-invalid token, letting callers report a 500 instead of a 401 for
 * the former. Use requireClerkSecretKey() to resolve it before calling.
 */
export async function verifyClerkToken(
  token: string,
  secretKey: string,
): Promise<string> {
  const { sub } = await verifyToken(token, { secretKey });
  return sub;
}
