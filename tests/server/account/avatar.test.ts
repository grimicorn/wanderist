/**
 * Unit tests for PATCH /api/account/avatar
 *
 * Clerk and auth utilities are mocked so no network access is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  stubCreateError,
  stubDefineEventHandler,
  buildAccountEvent,
  callHandler,
  assertThrows401WhenNotAuthenticated,
} from "./_helpers";

// ---------------------------------------------------------------------------
// Hoist mock factories
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockClerkSetProfileImage,
  mockClerkRemoveProfileImage,
  mockGetHeader,
  mockGetQuery,
  mockReadRawBody,
} = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
  mockClerkSetProfileImage: vi
    .fn()
    .mockResolvedValue("https://cdn.clerk.com/avatar.jpg"),
  mockClerkRemoveProfileImage: vi.fn().mockResolvedValue(undefined),
  mockGetHeader: vi.fn(),
  mockGetQuery: vi.fn(),
  mockReadRawBody: vi.fn(),
}));

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../../server/utils/clerkAccount", () => ({
  clerkSetProfileImage: mockClerkSetProfileImage,
  clerkRemoveProfileImage: mockClerkRemoveProfileImage,
}));

stubDefineEventHandler();
stubCreateError();
Object.assign(globalThis, {
  getHeader: mockGetHeader,
  getQuery: mockGetQuery,
  readRawBody: mockReadRawBody,
});

const { default: handler } =
  await import("../../../server/api/account/avatar.patch");

function stubUploadHeaders(contentType = "image/jpeg"): void {
  mockGetHeader.mockImplementation((_event: unknown, header: string) => {
    if (header === "content-type") {
      return contentType;
    }
    if (header === "content-length") {
      return "100";
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/account/avatar — upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({});
    stubUploadHeaders("image/jpeg");
    mockReadRawBody.mockResolvedValue(Buffer.from("fake-image"));
    mockClerkSetProfileImage.mockResolvedValue(
      "https://cdn.clerk.com/avatar.jpg",
    );
  });

  it("returns imageUrl on a successful upload", async () => {
    const result = (await callHandler(handler, buildAccountEvent())) as {
      imageUrl: string;
    };
    expect(result.imageUrl).toBe("https://cdn.clerk.com/avatar.jpg");
    expect(mockClerkSetProfileImage).toHaveBeenCalledWith(
      "user-1",
      expect.any(Blob),
    );
  });

  it("throws 415 for a disallowed content type", async () => {
    stubUploadHeaders("image/gif");

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it("throws 413 when actual body exceeds 4 MB", async () => {
    mockReadRawBody.mockResolvedValue(Buffer.alloc(5 * 1024 * 1024));

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("throws 400 for an empty body", async () => {
    mockReadRawBody.mockResolvedValue(null);

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when requireUser throws", async () => {
    await assertThrows401WhenNotAuthenticated(mockRequireUser, handler);
  });

  it("accepts image/png in addition to image/jpeg", async () => {
    stubUploadHeaders("image/png");

    const result = (await callHandler(handler, buildAccountEvent())) as {
      imageUrl: string;
    };
    expect(result.imageUrl).toBe("https://cdn.clerk.com/avatar.jpg");
  });
});

describe("PATCH /api/account/avatar — remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({ action: "remove" });
    mockClerkRemoveProfileImage.mockResolvedValue(undefined);
  });

  it("returns ok when removing the avatar", async () => {
    const result = await callHandler(handler, buildAccountEvent());
    expect(result).toEqual({ ok: true });
    expect(mockClerkRemoveProfileImage).toHaveBeenCalledWith("user-1");
  });

  it("throws 401 when requireUser throws on remove", async () => {
    await assertThrows401WhenNotAuthenticated(mockRequireUser, handler);
  });
});
