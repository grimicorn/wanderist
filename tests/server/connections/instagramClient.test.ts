/**
 * Unit tests for the Instagram API client module.
 * Network calls are mocked with vi.stubGlobal on fetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildInstagramAuthUrl,
  exchangeInstagramCode,
  exchangeForLongLivedToken,
  fetchInstagramUser,
  fetchInstagramMedia,
  filterGeotaggedMedia,
  INSTAGRAM_OAUTH_AUTHORIZE_URL,
  INSTAGRAM_SCOPES,
  type InstagramMediaItem,
} from "../../../server/utils/instagramClient";

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("buildInstagramAuthUrl", () => {
  it("includes the client_id, redirect_uri, scope, and state", () => {
    const url = buildInstagramAuthUrl({
      clientId: "client-123",
      redirectUri: "https://example.com/callback",
      state: "state-abc",
    });

    expect(url).toContain(INSTAGRAM_OAUTH_AUTHORIZE_URL);
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state-abc");
    expect(url).toContain(
      encodeURIComponent(INSTAGRAM_SCOPES)
        .replaceAll("%2C", ",")
        .split(",")[0]!,
    );
  });

  it("sets response_type=code", () => {
    const url = buildInstagramAuthUrl({
      clientId: "c",
      redirectUri: "https://r.com",
      state: "s",
    });
    expect(url).toContain("response_type=code");
  });
});

describe("exchangeInstagramCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("POSTs to the token URL and returns the token response", async () => {
    const tokenResponse = { access_token: "short-token", token_type: "bearer" };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(tokenResponse));

    const result = await exchangeInstagramCode({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://example.com/callback",
      code: "auth-code",
    });

    expect(result.access_token).toBe("short-token");
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("instagram.com");
    expect((options.method as string).toUpperCase()).toBe("POST");
  });

  it("throws when the API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse({ error: "bad" }, false, 400),
    );

    await expect(
      exchangeInstagramCode({
        clientId: "c",
        clientSecret: "s",
        redirectUri: "r",
        code: "code",
      }),
    ).rejects.toThrow();
  });
});

describe("exchangeForLongLivedToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns a long-lived token response", async () => {
    const longResponse = {
      access_token: "long-token",
      token_type: "bearer",
      expires_in: 5183944,
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(longResponse));

    const result = await exchangeForLongLivedToken({
      clientSecret: "secret",
      shortLivedToken: "short-token",
    });

    expect(result.access_token).toBe("long-token");
    expect(result.expires_in).toBeGreaterThan(0);
  });

  it("throws when the API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse({ error: "bad" }, false, 401),
    );

    await expect(
      exchangeForLongLivedToken({ clientSecret: "s", shortLivedToken: "t" }),
    ).rejects.toThrow();
  });
});

describe("fetchInstagramUser", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the user's id and username", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse({ id: "ig-123", username: "testuser" }),
    );

    const user = await fetchInstagramUser("access-token");

    expect(user.id).toBe("ig-123");
    expect(user.username).toBe("testuser");
  });

  it("passes the access_token in the query string", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse({ id: "ig-123" }));

    await fetchInstagramUser("my-token");

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain("access_token=my-token");
  });

  it("throws when the API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse({}, false, 401));

    await expect(fetchInstagramUser("bad-token")).rejects.toThrow();
  });
});

describe("fetchInstagramMedia", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the media response with a data array", async () => {
    const mediaResponse = {
      data: [
        {
          id: "m1",
          media_type: "IMAGE",
          media_url: "https://cdn.ig.com/m1.jpg",
          timestamp: "2024-01-01T00:00:00Z",
          permalink: "https://ig.com/p/m1",
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(mediaResponse));

    const result = await fetchInstagramMedia("access-token");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("m1");
  });

  it("throws when the API returns a non-OK status", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse({}, false, 400));

    await expect(fetchInstagramMedia("bad-token")).rejects.toThrow();
  });
});

describe("filterGeotaggedMedia", () => {
  it("returns only IMAGE items with a location that has coordinates", () => {
    const items: InstagramMediaItem[] = [
      {
        id: "1",
        media_type: "IMAGE",
        media_url: "https://cdn.ig.com/1.jpg",
        timestamp: "2024-01-01T00:00:00Z",
        permalink: "https://ig.com/1",
        location: { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
      },
      {
        id: "2",
        media_type: "IMAGE",
        media_url: "https://cdn.ig.com/2.jpg",
        timestamp: "2024-01-02T00:00:00Z",
        permalink: "https://ig.com/2",
        // No location — should be filtered out.
      },
      {
        id: "3",
        media_type: "VIDEO",
        media_url: "https://cdn.ig.com/3.mp4",
        timestamp: "2024-01-03T00:00:00Z",
        permalink: "https://ig.com/3",
        location: { name: "Rome", latitude: 41.9028, longitude: 12.4964 },
        // VIDEO type — should be filtered out.
      },
    ];

    const result = filterGeotaggedMedia(items);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("1");
  });

  it("returns an empty array when no items have a location", () => {
    const items: InstagramMediaItem[] = [
      {
        id: "1",
        media_type: "IMAGE",
        media_url: "https://cdn.ig.com/1.jpg",
        timestamp: "2024-01-01T00:00:00Z",
        permalink: "https://ig.com/1",
      },
    ];
    expect(filterGeotaggedMedia(items)).toHaveLength(0);
  });

  it("includes CAROUSEL_ALBUM items that have a location with lat/lon", () => {
    const items: InstagramMediaItem[] = [
      {
        id: "1",
        media_type: "CAROUSEL_ALBUM",
        media_url: "https://cdn.ig.com/carousel.jpg",
        timestamp: "2024-01-01T00:00:00Z",
        permalink: "https://ig.com/1",
        location: { name: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
      },
    ];
    expect(filterGeotaggedMedia(items)).toHaveLength(1);
  });
});
