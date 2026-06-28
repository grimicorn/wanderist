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
    return withSuffix(value, 1_000_000, "M");
  }

  const roundedThousands = Math.round((value / 1_000) * 10) / 10;
  // Guard rollover: values near 999 999 can round up to 1000k, so promote to M.
  if (roundedThousands >= 1_000) {
    return withSuffix(value, 1_000_000, "M");
  }
  return withSuffix(value, 1_000, "k");
}

function withSuffix(value: number, divisor: number, suffix: string): string {
  const scaled = Math.round((value / divisor) * 10) / 10;
  const formatted =
    scaled % 1 === 0 ? String(Math.round(scaled)) : scaled.toFixed(1);
  return `${formatted}${suffix}`;
}
