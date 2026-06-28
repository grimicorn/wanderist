import { describe, it, expect } from "vitest";
import { formatCompact } from "../formatNumber";

describe("formatCompact", () => {
  describe("below 1 000 — plain integer string", () => {
    it("returns '0' for 0", () => {
      expect(formatCompact(0)).toBe("0");
    });

    it("returns '1' for 1", () => {
      expect(formatCompact(1)).toBe("1");
    });

    it("returns '999' for 999 (boundary: just under 1k)", () => {
      expect(formatCompact(999)).toBe("999");
    });

    it("rounds to nearest integer for sub-1k values", () => {
      expect(formatCompact(9.7)).toBe("10");
    });

    it("returns '1000' boundary — 999.6 rounds to 1000 → '1k'", () => {
      expect(formatCompact(999.6)).toBe("1k");
    });

    it("returns '14' for 14 (streak-style value)", () => {
      expect(formatCompact(14)).toBe("14");
    });
  });

  describe("1 000 and above — compact k notation", () => {
    it("returns '1k' for exactly 1000", () => {
      expect(formatCompact(1_000)).toBe("1k");
    });

    it("returns '1.4k' for 1400", () => {
      expect(formatCompact(1_400)).toBe("1.4k");
    });

    it("returns '10k' for 10000", () => {
      expect(formatCompact(10_000)).toBe("10k");
    });

    it("returns '48.2k' for 48200", () => {
      expect(formatCompact(48_200)).toBe("48.2k");
    });

    it("returns '48.2k' for 48199 (rounds to one decimal)", () => {
      expect(formatCompact(48_199)).toBe("48.2k");
    });

    it("does not show trailing .0 — '2k' not '2.0k'", () => {
      expect(formatCompact(2_000)).toBe("2k");
    });

    it("returns '100k' for 100000", () => {
      expect(formatCompact(100_000)).toBe("100k");
    });

    it("returns '1.1k' for 1050", () => {
      expect(formatCompact(1_050)).toBe("1.1k");
    });

    it("returns '9.9k' for 9900", () => {
      expect(formatCompact(9_900)).toBe("9.9k");
    });
  });
});
