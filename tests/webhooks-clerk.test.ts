/**
 * Tests for the Clerk webhook handler event routing and ensureUser utility.
 *
 * Svix verification and DB calls are isolated behind seams so no network or
 * database access is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist all mock functions so they are available inside vi.mock() factories,
// which Vitest hoists to the top of the file before any imports run.
// ---------------------------------------------------------------------------

const {
  mockVerifySvixSignature,
  mockOnConflictDoUpdate,
  mockValues,
  mockInsert,
  mockWhere,
  mockDelete,
  mockLimit,
  mockSelectWhere,
  mockFrom,
  mockSelect,
  mockReadRawBody,
  mockGetHeader,
  mockGetUser,
} = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi.fn(() => ({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn(() => ({ where: mockWhere }));

  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockGetUser = vi.fn();

  return {
    mockVerifySvixSignature: vi.fn(),
    mockOnConflictDoUpdate,
    mockValues,
    mockInsert,
    mockWhere,
    mockDelete,
    mockLimit,
    mockSelectWhere,
    mockFrom,
    mockSelect,
    mockReadRawBody: vi.fn(),
    mockGetHeader: vi.fn(),
    mockGetUser,
  };
});

vi.mock("../server/utils/svix", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/utils/svix")>();
  return {
    ...actual,
    verifySvixSignature: mockVerifySvixSignature,
  };
});

vi.mock("../server/db/index", () => ({
  getDb: () => ({
    insert: mockInsert,
    delete: mockDelete,
    select: mockSelect,
  }),
}));

// auth.ts and middleware both import getClerkClient from the shared clerk util.
vi.mock("../server/utils/clerk", () => ({
  getClerkClient: () => ({ users: { getUser: mockGetUser } }),
}));

// ---------------------------------------------------------------------------
// Stub Nuxt/h3 auto-imports used by the handler and auth utils.
// These are injected at build time by Nitro; in tests we add them to globalThis.
// ---------------------------------------------------------------------------

Object.assign(globalThis, {
  readRawBody: mockReadRawBody,
  getHeader: mockGetHeader,
  getHeaders: vi.fn(),
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  defineEventHandler: (handler: (event: object) => unknown) => handler,
});

// ---------------------------------------------------------------------------
// Import modules after mocks are in place.
// ---------------------------------------------------------------------------

const { default: clerkWebhookHandler } =
  await import("../server/api/webhooks/clerk.post");
import { ensureUser } from "../server/utils/auth";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEST_SECRET =
  "whsec_" + Buffer.from("test-secret-32-bytes-padding!!").toString("base64");

const SAMPLE_PAYLOAD = {
  type: "user.created",
  data: {
    id: "user_abc123",
    email_addresses: [{ id: "idn_1", email_address: "test@example.com" }],
    primary_email_address_id: "idn_1",
  },
};

function buildMockEvent(): object {
  return { path: "/api/webhooks/clerk", context: {} };
}

function resetDbMocks() {
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  mockInsert.mockReturnValue({ values: mockValues });
  mockWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: mockWhere });
  mockLimit.mockResolvedValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

// ---------------------------------------------------------------------------
// clerk webhook handler tests
// ---------------------------------------------------------------------------

describe("clerk webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NUXT_CLERK_WEBHOOK_SECRET = TEST_SECRET;
    mockReadRawBody.mockResolvedValue(JSON.stringify(SAMPLE_PAYLOAD));
    mockGetHeader.mockReturnValue("test-value");
    resetDbMocks();
  });

  it("upserts a user row on user.created", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "user.created",
      data: {
        id: "user_abc123",
        email_addresses: [{ id: "idn_1", email_address: "test@example.com" }],
        primary_email_address_id: "idn_1",
      },
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "user_abc123",
      email: "test@example.com",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.anything(),
      set: { email: "test@example.com" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("upserts a user row on user.updated", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "user.updated",
      data: {
        id: "user_abc123",
        email_addresses: [{ id: "idn_1", email_address: "new@example.com" }],
        primary_email_address_id: "idn_1",
      },
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "user_abc123",
      email: "new@example.com",
    });
    expect(result).toEqual({ ok: true });
  });

  it("deletes the user row on user.deleted", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "user.deleted",
      data: { id: "user_abc123" },
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockDelete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("returns ok for unrecognized event types without touching the DB", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "session.created",
      data: {},
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("throws 400 when signature verification fails", async () => {
    mockVerifySvixSignature.mockImplementation(() => {
      throw new Error("No matching signature found");
    });

    await expect(
      (clerkWebhookHandler as (event: object) => Promise<unknown>)(
        buildMockEvent(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when the request body is empty", async () => {
    mockReadRawBody.mockResolvedValue(null);

    await expect(
      (clerkWebhookHandler as (event: object) => Promise<unknown>)(
        buildMockEvent(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 500 when NUXT_CLERK_WEBHOOK_SECRET is not set", async () => {
    delete process.env.NUXT_CLERK_WEBHOOK_SECRET;

    await expect(
      (clerkWebhookHandler as (event: object) => Promise<unknown>)(
        buildMockEvent(),
      ),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("calls verifySvixSignature with raw body, extracted headers, and the secret", async () => {
    process.env.NUXT_CLERK_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    mockReadRawBody.mockResolvedValue(rawBody);
    mockGetHeader.mockImplementation(
      (_event: unknown, name: string) => `${name}-value`,
    );
    mockVerifySvixSignature.mockReturnValue({
      type: "session.created",
      data: {},
    });

    await (clerkWebhookHandler as (event: object) => Promise<unknown>)(
      buildMockEvent(),
    );

    expect(mockVerifySvixSignature).toHaveBeenCalledWith(
      rawBody,
      expect.objectContaining({ "svix-id": expect.any(String) }),
      TEST_SECRET,
    );
  });

  it("returns ok and skips insert when a user.created payload has no primary email", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "user.created",
      data: {
        id: "user_phone_only",
        email_addresses: [],
        primary_email_address_id: "",
      },
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("returns ok and skips insert when email_addresses is absent in the payload", async () => {
    mockVerifySvixSignature.mockReturnValue({
      type: "user.created",
      data: { id: "user_no_email_field" },
    });

    const result = await (
      clerkWebhookHandler as (event: object) => Promise<unknown>
    )(buildMockEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// ensureUser tests
// ---------------------------------------------------------------------------

function buildAuthEvent(userId: string): object {
  return { context: { userId } };
}

describe("ensureUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NUXT_CLERK_SECRET_KEY = "sk_test_abc123";
    resetDbMocks();
  });

  it("returns userId immediately when the row already exists", async () => {
    mockLimit.mockResolvedValue([{ id: "user_existing" }]);

    const result = await ensureUser(buildAuthEvent("user_existing") as never);

    expect(result).toBe("user_existing");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("fetches from Clerk and upserts the row when the user is missing", async () => {
    mockLimit.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ id: "idn_1", emailAddress: "new@example.com" }],
      primaryEmailAddressId: "idn_1",
    });

    const result = await ensureUser(buildAuthEvent("user_new") as never);

    expect(mockGetUser).toHaveBeenCalledWith("user_new");
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "user_new",
      email: "new@example.com",
    });
    expect(result).toBe("user_new");
  });

  it("throws 422 when the Clerk user has no primary email", async () => {
    mockLimit.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({
      emailAddresses: [],
      primaryEmailAddressId: null,
    });

    await expect(
      ensureUser(buildAuthEvent("user_noemail") as never),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 401 when there is no userId in event context", async () => {
    await expect(ensureUser({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
