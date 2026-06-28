import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Nitro auto-imports
vi.stubGlobal(
  "defineEventHandler",
  (handler: (event: unknown) => unknown) => handler,
);
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    error.statusCode = options.statusCode;
    error.statusMessage = options.statusMessage;
    return error;
  },
);

vi.mock("../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from "../../server/utils/auth";

const mockRequireUser = vi.mocked(requireUser);

// Import the handler after mocks are set up. The handler module calls
// defineEventHandler at module load time; we stub it above so it just
// returns the inner function directly.
const healthHandler = await import("../../server/api/health.get");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId when the user is authenticated", async () => {
    mockRequireUser.mockReturnValue("user-abc");

    const handler =
      "default" in healthHandler ? healthHandler.default : healthHandler;
    const result = await (handler as (event: unknown) => unknown)({});

    expect(result).toEqual({ userId: "user-abc" });
  });

  it("propagates the 401 thrown by requireUser when unauthenticated", () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockRequireUser.mockImplementation(() => {
      throw unauthorizedError;
    });

    const handler =
      "default" in healthHandler ? healthHandler.default : healthHandler;

    expect(() => (handler as (event: unknown) => unknown)({})).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it("calls requireUser exactly once per request", async () => {
    mockRequireUser.mockReturnValue("user-xyz");

    const handler =
      "default" in healthHandler ? healthHandler.default : healthHandler;
    await (handler as (event: unknown) => unknown)({});

    expect(mockRequireUser).toHaveBeenCalledTimes(1);
  });
});
