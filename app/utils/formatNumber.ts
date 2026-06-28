/**
 * Compact number formatter for stat display.
 *
 * Below 1 000:        returns the integer as a plain string  ("999")
 * 1 000 – 999 999:    one decimal if needed, "k" suffix       ("1k", "1.4k", "48.2k")
 * 1 000 000+:         one decimal if needed, "M" suffix       ("1M", "1.4M")
 *
 * Trailing ".0" is stripped so "1.0k" becomes "1k".
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const roundedInt = Math.round(value);
  if (roundedInt < 1_000) {
    return String(roundedInt);
  }

  if (roundedInt >= 1_000_000) {
    const millions = value / 1_000_000;
    const roundedMillions = Math.round(millions * 10) / 10;
    const formatted =
      roundedMillions % 1 === 0
        ? String(Math.round(roundedMillions))
        : roundedMillions.toFixed(1);
    return `${formatted}M`;
  }

  const thousands = value / 1_000;
  const roundedThousands = Math.round(thousands * 10) / 10;
  const formatted =
    roundedThousands % 1 === 0
      ? String(Math.round(roundedThousands))
      : roundedThousands.toFixed(1);
  return `${formatted}k`;
}
