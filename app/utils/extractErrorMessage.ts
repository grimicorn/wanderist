const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred";

/**
 * Extracts a human-readable error message from an unknown thrown value.
 *
 * Priority:
 * 1. `error.data.statusMessage` — Nitro server errors wrapped by ofetch
 * 2. `error.statusMessage` — direct H3 error objects
 * 3. `error.message` — standard Error instances
 * 4. Generic fallback message
 */
export function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return UNEXPECTED_ERROR_MESSAGE;
  }

  const errorObj = error as Record<string, unknown>;

  const nestedStatusMessage = readNestedStatusMessage(errorObj.data);
  if (nestedStatusMessage) {
    return nestedStatusMessage;
  }

  // Use || (truthiness) rather than ?? so that an empty-string field falls
  // through to the next candidate, matching readNestedStatusMessage's behaviour.
  return (
    readStringField(errorObj, "statusMessage") ||
    readStringField(errorObj, "message") ||
    UNEXPECTED_ERROR_MESSAGE
  );
}

function readNestedStatusMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const dataObj = data as Record<string, unknown>;
  return readStringField(dataObj, "statusMessage");
}

function readStringField(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  return typeof value === "string" ? value : null;
}
