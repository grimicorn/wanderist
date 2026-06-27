import { describe, it, expect } from "vitest";
import {
  users,
  media,
  places,
  trips,
  tripStops,
  entries,
  tags,
  entryTags,
  entryPhotos,
  follows,
  notifications,
  connectedAccounts,
  userPreferences,
  TRIP_STATUS,
  VISIBILITY,
  TRIP_STOP_STATUS,
  CONNECTED_ACCOUNT_PROVIDER,
  DISTANCE_UNIT,
  tripStatusEnum,
  visibilityEnum,
  tripStopStatusEnum,
  connectedAccountProviderEnum,
  distanceUnitEnum,
} from "../server/db/schema";

// ---------------------------------------------------------------------------
// Table existence — verify every exported table is a Drizzle table object
// with the expected SQL name.
// ---------------------------------------------------------------------------

describe("schema table exports", () => {
  it("users table has correct SQL name", () => {
    expect(users[Symbol.for("drizzle:Name")]).toBe("users");
  });

  it("media table has correct SQL name", () => {
    expect(media[Symbol.for("drizzle:Name")]).toBe("media");
  });

  it("places table has correct SQL name", () => {
    expect(places[Symbol.for("drizzle:Name")]).toBe("places");
  });

  it("trips table has correct SQL name", () => {
    expect(trips[Symbol.for("drizzle:Name")]).toBe("trips");
  });

  it("tripStops table has correct SQL name", () => {
    expect(tripStops[Symbol.for("drizzle:Name")]).toBe("trip_stops");
  });

  it("entries table has correct SQL name", () => {
    expect(entries[Symbol.for("drizzle:Name")]).toBe("entries");
  });

  it("tags table has correct SQL name", () => {
    expect(tags[Symbol.for("drizzle:Name")]).toBe("tags");
  });

  it("entryTags table has correct SQL name", () => {
    expect(entryTags[Symbol.for("drizzle:Name")]).toBe("entry_tags");
  });

  it("entryPhotos table has correct SQL name", () => {
    expect(entryPhotos[Symbol.for("drizzle:Name")]).toBe("entry_photos");
  });

  it("follows table has correct SQL name", () => {
    expect(follows[Symbol.for("drizzle:Name")]).toBe("follows");
  });

  it("notifications table has correct SQL name", () => {
    expect(notifications[Symbol.for("drizzle:Name")]).toBe("notifications");
  });

  it("connectedAccounts table has correct SQL name", () => {
    expect(connectedAccounts[Symbol.for("drizzle:Name")]).toBe(
      "connected_accounts",
    );
  });

  it("userPreferences table has correct SQL name", () => {
    expect(userPreferences[Symbol.for("drizzle:Name")]).toBe(
      "user_preferences",
    );
  });
});

// ---------------------------------------------------------------------------
// Named constants — verify enum values are not magic strings at call sites,
// and that the pgEnum values stay in sync with the constant objects.
// ---------------------------------------------------------------------------

describe("enum constant exports", () => {
  it("TRIP_STATUS covers all three states", () => {
    expect(TRIP_STATUS.ONGOING).toBe("ongoing");
    expect(TRIP_STATUS.UPCOMING).toBe("upcoming");
    expect(TRIP_STATUS.PAST).toBe("past");
  });

  it("VISIBILITY covers private and public", () => {
    expect(VISIBILITY.PRIVATE).toBe("private");
    expect(VISIBILITY.PUBLIC).toBe("public");
  });

  it("TRIP_STOP_STATUS covers done, next, planned", () => {
    expect(TRIP_STOP_STATUS.DONE).toBe("done");
    expect(TRIP_STOP_STATUS.NEXT).toBe("next");
    expect(TRIP_STOP_STATUS.PLANNED).toBe("planned");
  });

  it("CONNECTED_ACCOUNT_PROVIDER covers instagram and google", () => {
    expect(CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM).toBe("instagram");
    expect(CONNECTED_ACCOUNT_PROVIDER.GOOGLE).toBe("google");
  });

  it("DISTANCE_UNIT covers mi and km", () => {
    expect(DISTANCE_UNIT.MI).toBe("mi");
    expect(DISTANCE_UNIT.KM).toBe("km");
  });
});

// ---------------------------------------------------------------------------
// pgEnum alignment — verify the Drizzle enum value sets stay in sync with
// the constant objects so migration drift fails the build.
// ---------------------------------------------------------------------------

describe("pgEnum values match constant objects", () => {
  it("tripStatusEnum values match TRIP_STATUS", () => {
    expect([...tripStatusEnum.enumValues].sort()).toEqual(
      Object.values(TRIP_STATUS).sort(),
    );
  });

  it("visibilityEnum values match VISIBILITY", () => {
    expect([...visibilityEnum.enumValues].sort()).toEqual(
      Object.values(VISIBILITY).sort(),
    );
  });

  it("tripStopStatusEnum values match TRIP_STOP_STATUS", () => {
    expect([...tripStopStatusEnum.enumValues].sort()).toEqual(
      Object.values(TRIP_STOP_STATUS).sort(),
    );
  });

  it("connectedAccountProviderEnum values match CONNECTED_ACCOUNT_PROVIDER", () => {
    expect([...connectedAccountProviderEnum.enumValues].sort()).toEqual(
      Object.values(CONNECTED_ACCOUNT_PROVIDER).sort(),
    );
  });

  it("distanceUnitEnum values match DISTANCE_UNIT", () => {
    expect([...distanceUnitEnum.enumValues].sort()).toEqual(
      Object.values(DISTANCE_UNIT).sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// Column presence — spot-check that key columns exist on each table
// ---------------------------------------------------------------------------

describe("column presence", () => {
  it("users has id, email, createdAt, updatedAt", () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();
  });

  it("trips has userId, status, visibility, coverImageId", () => {
    expect(trips.userId).toBeDefined();
    expect(trips.status).toBeDefined();
    expect(trips.visibility).toBeDefined();
    expect(trips.coverImageId).toBeDefined();
  });

  it("entries has tripId, placeId, visibility, likeCount", () => {
    expect(entries.tripId).toBeDefined();
    expect(entries.placeId).toBeDefined();
    expect(entries.visibility).toBeDefined();
    expect(entries.likeCount).toBeDefined();
  });

  it("follows has followerId and followeeId", () => {
    expect(follows.followerId).toBeDefined();
    expect(follows.followeeId).toBeDefined();
  });

  it("connectedAccounts has provider, externalId, accessToken", () => {
    expect(connectedAccounts.provider).toBeDefined();
    expect(connectedAccounts.externalId).toBeDefined();
    expect(connectedAccounts.accessToken).toBeDefined();
  });

  it("userPreferences has distanceUnit, publicProfile, handle, bio", () => {
    expect(userPreferences.distanceUnit).toBeDefined();
    expect(userPreferences.publicProfile).toBeDefined();
    expect(userPreferences.handle).toBeDefined();
    expect(userPreferences.bio).toBeDefined();
  });
});
