/**
 * Unit tests for the useConnections composable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// ---------------------------------------------------------------------------
// Mock auto-imports and composables
// ---------------------------------------------------------------------------

const mockApiFetch = vi.fn();

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: () => ({ apiFetch: mockApiFetch }),
}));

vi.stubGlobal("useState", <T>(key: string, init: () => T) => {
  const state = ref(init());
  return state;
});

vi.stubGlobal("readonly", (value: unknown) => value);

// ---------------------------------------------------------------------------
// Import composable after mocks
// ---------------------------------------------------------------------------

const { useConnections } = await import("../useConnections");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchConnections", () => {
    it("populates google connection info from the API", async () => {
      // fetchConnections fires two parallel calls: instagram then google.
      mockApiFetch
        .mockResolvedValueOnce({ connected: false })
        .mockResolvedValueOnce({
          connected: true,
          emailAddress: "user@gmail.com",
          identificationId: "idn_abc",
        });

      const { fetchConnections, connections } = useConnections();
      await fetchConnections();

      expect(
        (
          connections as {
            value: {
              google: { connected: boolean; emailAddress: string | null };
            };
          }
        ).value.google.connected,
      ).toBe(true);
      expect(
        (
          connections as {
            value: {
              google: { connected: boolean; emailAddress: string | null };
            };
          }
        ).value.google.emailAddress,
      ).toBe("user@gmail.com");
    });

    it("sets loadError when the API call fails", async () => {
      mockApiFetch.mockRejectedValueOnce(
        Object.assign(new Error("Network error"), {
          statusMessage: "Network error",
        }),
      );

      const { fetchConnections, loadError } = useConnections();
      await fetchConnections();

      expect((loadError as { value: string | null }).value).toBe(
        "Network error",
      );
    });
  });

  describe("disconnectInstagram", () => {
    it("calls DELETE /api/connections/instagram and updates connected state", async () => {
      mockApiFetch.mockResolvedValueOnce({ ok: true });

      const { disconnectInstagram, connections } = useConnections();
      const result = await disconnectInstagram();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/connections/instagram", {
        method: "DELETE",
      });
      expect(result).toBe(true);
      expect(
        (connections as { value: { instagram: { connected: boolean } } }).value
          .instagram.connected,
      ).toBe(false);
    });

    it("sets actionError and returns false on failure", async () => {
      mockApiFetch.mockRejectedValueOnce(
        Object.assign(new Error("Not connected"), {
          statusMessage: "Not connected",
        }),
      );

      const { disconnectInstagram, actionError } = useConnections();
      const result = await disconnectInstagram();

      expect(result).toBe(false);
      expect((actionError as { value: string | null }).value).toBe(
        "Not connected",
      );
    });
  });

  describe("disconnectGoogle", () => {
    it("calls DELETE /api/connections/google with the identificationId", async () => {
      // fetchConnections fires two parallel calls (instagram, google) then
      // disconnectGoogle fires a third.
      mockApiFetch
        .mockResolvedValueOnce({ connected: false })
        .mockResolvedValueOnce({
          connected: true,
          emailAddress: "u@g.com",
          identificationId: "idn_abc",
        })
        .mockResolvedValueOnce({ ok: true });

      const { fetchConnections, disconnectGoogle } = useConnections();
      await fetchConnections();
      const result = await disconnectGoogle();

      expect(result).toBe(true);
      expect(mockApiFetch).toHaveBeenCalledWith("/api/connections/google", {
        method: "DELETE",
        body: { identificationId: "idn_abc" },
      });
    });

    it("sets actionError and returns false when Google is not connected", async () => {
      const { disconnectGoogle, actionError } = useConnections();
      const result = await disconnectGoogle();

      expect(result).toBe(false);
      expect((actionError as { value: string | null }).value).toBeTruthy();
    });
  });

  describe("importInstagramPhotos", () => {
    it("calls POST /api/connections/instagram/import and sets importResult", async () => {
      mockApiFetch.mockResolvedValueOnce({
        imported: 5,
        skipped: 1,
        errors: [],
      });

      const { importInstagramPhotos, importResult } = useConnections();
      const result = await importInstagramPhotos();

      expect(result).toBe(true);
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/connections/instagram/import",
        { method: "POST" },
      );
      expect(
        (importResult as { value: { imported: number } | null }).value
          ?.imported,
      ).toBe(5);
    });

    it("sets actionError and returns false on failure", async () => {
      mockApiFetch.mockRejectedValueOnce(
        Object.assign(new Error("Not connected"), {
          statusMessage: "Instagram account not connected",
        }),
      );

      const { importInstagramPhotos, actionError } = useConnections();
      const result = await importInstagramPhotos();

      expect(result).toBe(false);
      expect((actionError as { value: string | null }).value).toBeTruthy();
    });
  });

  describe("fetchConnections", () => {
    it("fetches both Instagram and Google connections in parallel", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ connected: true })
        .mockResolvedValueOnce({
          connected: true,
          emailAddress: "u@g.com",
          identificationId: "idn_abc",
        });

      const { fetchConnections, connections } = useConnections();
      await fetchConnections();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/connections/instagram");
      expect(mockApiFetch).toHaveBeenCalledWith("/api/connections/google");
      expect(
        (connections as { value: { instagram: { connected: boolean } } }).value
          .instagram.connected,
      ).toBe(true);
    });
  });
});
