import { requireUser } from "../../utils/auth";
import {
  clerkSetProfileImage,
  clerkRemoveProfileImage,
} from "../../utils/clerkAccount";

// 4 MB expressed in bytes — matches the UI copy "up to 4MB".
const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024;

const ALLOWED_AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);

function assertAvatarContentTypeAllowed(contentType: string): void {
  if (!ALLOWED_AVATAR_CONTENT_TYPES.has(contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `Unsupported media type. Allowed: ${[...ALLOWED_AVATAR_CONTENT_TYPES].join(", ")}`,
    });
  }
}

function assertAvatarSizeAllowed(byteLength: number): void {
  if (byteLength > MAX_AVATAR_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `File too large. Maximum avatar size is ${MAX_AVATAR_SIZE_BYTES / (1024 * 1024)} MB`,
    });
  }
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);

  // A DELETE action is signalled via ?action=remove on PATCH to avoid needing a
  // separate DELETE route (Nitro only allows one handler per method/path combo).
  const query = getQuery(event);
  if (query.action === "remove") {
    await clerkRemoveProfileImage(userId);
    return { ok: true };
  }

  const contentType = (getHeader(event, "content-type") ?? "")
    .split(";")[0]
    .trim();
  assertAvatarContentTypeAllowed(contentType);

  const declaredLength = Number(getHeader(event, "content-length") ?? 0);
  assertAvatarSizeAllowed(declaredLength);

  const rawBody = await readRawBody(event, false);
  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  assertAvatarSizeAllowed(rawBody.byteLength);

  const fileBlob = new Blob([rawBody], { type: contentType });
  const imageUrl = await clerkSetProfileImage(userId, fileBlob);

  return { imageUrl };
});
