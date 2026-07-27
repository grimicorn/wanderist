/**
 * Generates a random id for a new row.
 *
 * Several resources (trips, places, entries, guides) each define an
 * equivalent one-liner locally. This is the version new resources should
 * import rather than adding yet another copy; existing copies are left
 * alone as a separate follow-up.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
