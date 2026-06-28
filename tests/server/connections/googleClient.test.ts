/**
 * Unit tests for the Google connection client module.
 * The Clerk client and fetch are mocked so no network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchGoogleConnectionInfo,
  disconnectGoogleAccount,
  GOOGLE_PROVIDER_ID,
} from "../../../server/utils/googleClient";
import type { createClerkClient } from "@clerk/backend";

type ClerkClient = ReturnType<typeof createClerkClient>;

function makeClerkClientMock(
  externalAccounts: Array<{
    id: string;
    provider: string;
    emailAddress: string;
  }>,
): ClerkClient {
  return {
    users: {
      getUser: vi.fn().mockResolvedValue({ externalAccounts }),
    },
  } as unknown as ClerkClient;
}

describe("fetchGoogleConnectionInfo", () => {
  it("returns connected: true with email when a Google account exists", async () => {
    const clerkClient = makeClerkClientMock([
      {
        id: "idn_abc",
        provider: GOOGLE_PROVIDER_ID,
        emailAddress: "user@gmail.com",
      },
    ]);

    const result = await fetchGoogleConnectionInfo(clerkClient, "user-1");

    expect(result.connected).toBe(true);
    expect(result.emailAddress).toBe("user@gmail.com");
    expect(result.identificationId).toBe("idn_abc");
  });

  it("returns connected: false when no Google account is linked", async () => {
    const clerkClient = makeClerkClientMock([]);

    const result = await fetchGoogleConnectionInfo(clerkClient, "user-1");

    expect(result.connected).toBe(false);
    expect(result.emailAddress).toBeNull();
    expect(result.identificationId).toBeNull();
  });

  it("ignores non-Google external accounts", async () => {
    const clerkClient = makeClerkClientMock([
      { id: "idn_gh", provider: "github", emailAddress: "user@github.com" },
    ]);

    const result = await fetchGoogleConnectionInfo(clerkClient, "user-1");

    expect(result.connected).toBe(false);
  });

  it("passes the userId to the Clerk getUser call", async () => {
    const clerkClient = makeClerkClientMock([]);
    await fetchGoogleConnectionInfo(clerkClient, "user-xyz");

    expect(clerkClient.users.getUser).toHaveBeenCalledWith("user-xyz");
  });
});

describe("disconnectGoogleAccount", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  function stubFetch(
    listResponse: unknown,
    deleteResponse: unknown = { deleted: true },
  ): void {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(listResponse),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(deleteResponse),
      } as unknown as Response);
  }

  it("lists external accounts then deletes the matching one", async () => {
    stubFetch([
      {
        id: "eac_real",
        identification_id: "idn_abc",
        provider: GOOGLE_PROVIDER_ID,
      },
    ]);

    await disconnectGoogleAccount("sk_secret", "user-1", "idn_abc");

    expect(fetch).toHaveBeenCalledTimes(2);
    const [deleteUrl] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(deleteUrl).toContain("eac_real");
    expect(deleteUrl).toContain("user-1");
  });

  it("handles a paginated { data: [] } response shape from Clerk BAPI", async () => {
    stubFetch({
      data: [
        {
          id: "eac_real",
          identification_id: "idn_abc",
          provider: GOOGLE_PROVIDER_ID,
        },
      ],
      total_count: 1,
    });

    await disconnectGoogleAccount("sk_secret", "user-1", "idn_abc");

    expect(fetch).toHaveBeenCalledTimes(2);
    const [deleteUrl] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(deleteUrl).toContain("eac_real");
  });

  it("treats a missing account as already disconnected (success, no delete call)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await expect(
      disconnectGoogleAccount("sk_secret", "user-1", "idn_missing"),
    ).resolves.toBeUndefined();

    // Only one fetch call (the list); no delete.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when the list API call fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    } as unknown as Response);

    await expect(
      disconnectGoogleAccount("sk_secret", "user-1", "idn_abc"),
    ).rejects.toThrow();
  });

  it("throws when the delete API call fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "eac_real",
              identification_id: "idn_abc",
              provider: GOOGLE_PROVIDER_ID,
            },
          ]),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      } as unknown as Response);

    await expect(
      disconnectGoogleAccount("sk_secret", "user-1", "idn_abc"),
    ).rejects.toThrow();
  });
});
