import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installNitroGlobals,
  unwrapHandler,
  makeSelectChain,
} from "./_helpers";

installNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);

const handler = await import("../../../server/api/notifications/index.get");
const callHandler = () => unwrapHandler(handler as Record<string, unknown>)({});

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notifications with the resolved actor for the authenticated user", async () => {
    mockRequireUser.mockReturnValue("user-1");

    const rawRows = [
      {
        id: "notif-1",
        type: "new_follower",
        tone: "accent",
        body: "Someone started following you",
        isRead: false,
        createdAt: new Date("2024-06-01T10:00:00Z"),
        actorId: "follower-1",
        actorDisplayName: "Elsa Farsdottir",
        actorHandle: "elsa_far",
        actorDeletedAt: null,
      },
    ];

    const selectChain = makeSelectChain(rawRows);
    mockGetDb.mockReturnValue(
      selectChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();
    expect(result).toEqual({
      notifications: [
        {
          id: "notif-1",
          type: "new_follower",
          tone: "accent",
          body: "Someone started following you",
          isRead: false,
          createdAt: new Date("2024-06-01T10:00:00Z"),
          actor: {
            id: "follower-1",
            displayName: "Elsa Farsdottir",
            handle: "elsa_far",
          },
        },
      ],
    });
  });

  it("resolves a legacy notification (no actorId recorded) to a null actor", async () => {
    mockRequireUser.mockReturnValue("user-1");

    const rawRows = [
      {
        id: "notif-legacy",
        type: "new_follower",
        tone: "accent",
        body: "Someone started following you",
        isRead: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        actorId: null,
        actorDisplayName: null,
        actorHandle: null,
        actorDeletedAt: null,
      },
    ];

    const selectChain = makeSelectChain(rawRows);
    mockGetDb.mockReturnValue(
      selectChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();
    expect(result).toEqual({
      notifications: [expect.objectContaining({ actor: null })],
    });
  });

  it("resolves a notification whose actor has since deleted their account to a null actor", async () => {
    mockRequireUser.mockReturnValue("user-1");

    const rawRows = [
      {
        id: "notif-deleted-actor",
        type: "new_follower",
        tone: "accent",
        body: "Someone started following you",
        isRead: false,
        createdAt: new Date("2024-06-01T10:00:00Z"),
        actorId: "former-user",
        actorDisplayName: "Departed Traveler",
        actorHandle: "departed",
        actorDeletedAt: new Date("2024-05-01T00:00:00Z"),
      },
    ];

    const selectChain = makeSelectChain(rawRows);
    mockGetDb.mockReturnValue(
      selectChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();
    expect(result).toEqual({
      notifications: [expect.objectContaining({ actor: null })],
    });
  });

  it("returns an empty notifications array when the user has none", async () => {
    mockRequireUser.mockReturnValue("user-1");

    const selectChain = makeSelectChain([]);
    mockGetDb.mockReturnValue(
      selectChain as unknown as ReturnType<typeof getDb>,
    );

    const result = await callHandler();
    expect(result).toEqual({ notifications: [] });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });
});
