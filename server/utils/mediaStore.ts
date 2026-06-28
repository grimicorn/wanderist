/**
 * Thin abstraction over Netlify Blobs so API handlers can be unit-tested
 * without hitting the network. Import and use these functions rather than
 * calling @netlify/blobs directly in handlers.
 */
import { getStore } from "@netlify/blobs";

export const MEDIA_STORE_NAME = "media";

// Content-type metadata key stored alongside each blob.
export const BLOB_CONTENT_TYPE_KEY = "contentType";

function openStore(): ReturnType<typeof getStore> {
  return getStore(MEDIA_STORE_NAME);
}

export async function putMediaBlob(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const store = openStore();
  await store.set(key, data, {
    metadata: { [BLOB_CONTENT_TYPE_KEY]: contentType },
  });
}

export async function getMediaBlob(key: string): Promise<{
  data: ArrayBuffer;
  contentType: string | null;
} | null> {
  const store = openStore();
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });

  if (!result) {
    return null;
  }

  const contentType =
    typeof result.metadata?.[BLOB_CONTENT_TYPE_KEY] === "string"
      ? result.metadata[BLOB_CONTENT_TYPE_KEY]
      : null;

  return { data: result.data as ArrayBuffer, contentType };
}

export async function removeMediaBlob(key: string): Promise<void> {
  const store = openStore();
  await store.delete(key);
}
