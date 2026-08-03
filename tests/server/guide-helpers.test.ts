/**
 * Unit tests for server/utils/guide-helpers.ts
 */
import { describe, it, expect, vi } from "vitest";

const mockCreateError = vi.fn(
  (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
);

Object.assign(globalThis, {
  createError: mockCreateError,
});

const {
  parseReadTimeMinutes,
  parseOptionalGuideBody,
  loadReadableGuide,
  MIN_READ_TIME_MINUTES,
  MAX_READ_TIME_MINUTES,
} = await import("../../server/utils/guide-helpers");

type FakeDatabase = Parameters<typeof loadReadableGuide>[0];

// Minimal stand-in for the query chains loadReadableGuide walks. It may issue
// up to two queries — the guide lookup, then (for a non-owner) the author's
// discoverability check — so each `.limit()` returns the next queued response.
// Lets the visibility rule be exercised in isolation without a real database.
function fakeDbSequence(responses: Record<string, unknown>[][]): FakeDatabase {
  let call = 0;
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(responses[call++] ?? []),
  };
  return { select: () => chain } as unknown as FakeDatabase;
}

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

function guideRow(overrides: Record<string, unknown>) {
  return {
    id: "guide-1",
    userId: OWNER_ID,
    title: "Tokyo on foot",
    body: "Start in Yanaka at sunrise.",
    readTimeMinutes: 8,
    likeCount: 3,
    visibility: "private",
    ...overrides,
  };
}

describe("parseReadTimeMinutes", () => {
  it("returns undefined when the value is absent", () => {
    expect(parseReadTimeMinutes(undefined)).toBeUndefined();
  });

  it("returns the value when it is a valid integer at the floor", () => {
    expect(parseReadTimeMinutes(MIN_READ_TIME_MINUTES)).toBe(
      MIN_READ_TIME_MINUTES,
    );
  });

  it("returns the value when it is a valid integer above the floor", () => {
    expect(parseReadTimeMinutes(8)).toBe(8);
  });

  it("throws 400 when the value is below the floor", () => {
    expect(() => parseReadTimeMinutes(0)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("returns the value when it is a valid integer at the ceiling", () => {
    expect(parseReadTimeMinutes(MAX_READ_TIME_MINUTES)).toBe(
      MAX_READ_TIME_MINUTES,
    );
  });

  it("throws 400 when the value is above the ceiling", () => {
    expect(() => parseReadTimeMinutes(MAX_READ_TIME_MINUTES + 1)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 for a wildly out-of-range value that would overflow a Postgres int4", () => {
    expect(() => parseReadTimeMinutes(3000000000)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is not an integer", () => {
    expect(() => parseReadTimeMinutes(3.5)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is explicitly null", () => {
    // parseOptionalInt returns `null` for `null` — this column is NOT NULL,
    // so null must be rejected rather than silently reaching the database.
    expect(() => parseReadTimeMinutes(null)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("throws 400 when the value is negative", () => {
    expect(() => parseReadTimeMinutes(-3)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("parseOptionalGuideBody", () => {
  it("returns undefined when the value is absent", () => {
    expect(parseOptionalGuideBody(undefined)).toBeUndefined();
  });

  it("returns undefined when the value is explicitly null", () => {
    expect(parseOptionalGuideBody(null)).toBeUndefined();
  });

  it("returns null for an empty string", () => {
    expect(parseOptionalGuideBody("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseOptionalGuideBody("   ")).toBeNull();
  });

  it("returns the trimmed string for a non-blank value", () => {
    expect(parseOptionalGuideBody(" Start at the north jetty. ")).toBe(
      "Start at the north jetty.",
    );
  });

  it("throws 400 when the value is not a string", () => {
    expect(() => parseOptionalGuideBody(42)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("loadReadableGuide", () => {
  // A row from the author-discoverability query — its presence means the author
  // is live, public, and on explore.
  const discoverableOwner = [{ userId: OWNER_ID }];

  it("returns a private guide to its owner without a discoverability check", async () => {
    const guide = guideRow({ visibility: "private", userId: OWNER_ID });

    await expect(
      loadReadableGuide(fakeDbSequence([[guide]]), "guide-1", OWNER_ID),
    ).resolves.toEqual(guide);
  });

  it("returns a public guide to a non-owner when the author is discoverable", async () => {
    const guide = guideRow({ visibility: "public", userId: OWNER_ID });

    await expect(
      loadReadableGuide(
        fakeDbSequence([[guide], discoverableOwner]),
        "guide-1",
        OTHER_ID,
      ),
    ).resolves.toEqual(guide);
  });

  it("throws 404 for a private guide requested by a non-owner", async () => {
    const guide = guideRow({ visibility: "private", userId: OWNER_ID });

    await expect(
      loadReadableGuide(fakeDbSequence([[guide]]), "guide-1", OTHER_ID),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));
  });

  it("throws 404 for a public guide whose author is not discoverable (deleted / private / off-explore)", async () => {
    const guide = guideRow({ visibility: "public", userId: OWNER_ID });

    // Empty second response = the author fails the discoverability predicate.
    await expect(
      loadReadableGuide(fakeDbSequence([[guide], []]), "guide-1", OTHER_ID),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));
  });

  it("throws 404 when the guide does not exist", async () => {
    await expect(
      loadReadableGuide(fakeDbSequence([[]]), "missing", OWNER_ID),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));
  });
});
