import { createClerkClient } from "@clerk/backend";

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (cachedClerkClient) return cachedClerkClient;
  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }
  cachedClerkClient = createClerkClient({ secretKey });
  return cachedClerkClient;
}

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  const clerkClient = getClerkClient();

  const token = getHeader(event, "authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  try {
    const { sub } = await clerkClient.verifyToken(token);
    event.context.userId = sub;
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
});
