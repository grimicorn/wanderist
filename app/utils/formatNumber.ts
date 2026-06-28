/**
 * Compact number formatter for stat display.
 *
 * Below 1 000:        returns the integer as a plain string  ("999")
 * 1 000 – 9 999:      one decimal if needed, "k" suffix       ("1k", "1.4k")
 * 10 000+:            one decimal if needed, "k" suffix       ("48.2k")
 *
 * Trailing ".0" is stripped so "1.0k" becomes "1k".
 */
export function formatCompact(value: number): string {
  if (value < 1_000) {
    return String(Math.round(value));
  }

  const thousands = value / 1_000;
  const rounded = Math.round(thousands * 10) / 10;
  const formatted =
    rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${formatted}k`;
}
