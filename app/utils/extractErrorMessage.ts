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
  const data = errorObj.data;

  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj.statusMessage === "string") {
      return dataObj.statusMessage;
    }
  }

  if (typeof errorObj.statusMessage === "string") {
    return errorObj.statusMessage;
  }

  if (typeof errorObj.message === "string") {
    return errorObj.message;
  }

  return UNEXPECTED_ERROR_MESSAGE;
}
