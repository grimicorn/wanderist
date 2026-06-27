import { describe, it, expect } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../server/db/schema";
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

// ---------------------------------------------------------------------------
// ON DELETE policy — assert the referential-action encoded on each FK so the
// build fails if the policy regresses (e.g. a cascade silently becomes the
// Drizzle default of "no action"). Read directly from the Drizzle table config
// rather than the generated SQL so the assertion tracks the source of truth.
//
// Policy:
//   - cascade   → NOT NULL ownership FKs and owned child / join rows
//   - set null  → nullable optional cross-references
// ---------------------------------------------------------------------------

const ON_DELETE = {
  CASCADE: "cascade",
  SET_NULL: "set null",
} as const;

type OnDeleteAction = (typeof ON_DELETE)[keyof typeof ON_DELETE];

// The policy is keyed by a single referencing column. The assertion below
// guards that every FK in the schema is single-column so this 1:1 mapping
// (and the FK-count coverage check) stays valid if a composite FK is added.
const FK_REFERENCING_COLUMN_COUNT = 1;

function onDeleteForColumn(
  table: PgTable,
  columnName: string,
): string | undefined {
  const { foreignKeys } = getTableConfig(table);
  const match = foreignKeys.find((foreignKey) =>
    foreignKey.reference().columns.some((column) => column.name === columnName),
  );
  if (!match) {
    return undefined;
  }
  return match.onDelete;
}

function schemaTables(): ReadonlyArray<PgTable> {
  return Object.values(schema).filter((value): value is PgTable =>
    is(value, PgTable),
  );
}

// A stable `<table>.<column>` identifier for each FK so the policy can be
// compared as a set rather than a count — a duplicate policy entry masking a
// missing FK, or a typo'd column name, both surface as a set mismatch.
function foreignKeyIdsFromSchema(): ReadonlyArray<string> {
  return schemaTables().flatMap((table) => {
    const { name, foreignKeys } = getTableConfig(table);
    return foreignKeys.flatMap((foreignKey) =>
      foreignKey.reference().columns.map((column) => `${name}.${column.name}`),
    );
  });
}

function foreignKeyIdsFromPolicy(): ReadonlyArray<string> {
  return ON_DELETE_POLICY.map(
    (entry) => `${getTableConfig(entry.table).name}.${entry.column}`,
  );
}

const ON_DELETE_POLICY: ReadonlyArray<{
  label: string;
  table: PgTable;
  column: string;
  expected: OnDeleteAction;
}> = [
  {
    label: "media.userId",
    table: media,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "places.userId",
    table: places,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "trips.userId",
    table: trips,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "trips.coverImageId",
    table: trips,
    column: "cover_image_id",
    expected: ON_DELETE.SET_NULL,
  },
  {
    label: "tripStops.tripId",
    table: tripStops,
    column: "trip_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "tripStops.placeId",
    table: tripStops,
    column: "place_id",
    expected: ON_DELETE.SET_NULL,
  },
  {
    label: "entries.userId",
    table: entries,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "entries.tripId",
    table: entries,
    column: "trip_id",
    expected: ON_DELETE.SET_NULL,
  },
  {
    label: "entries.placeId",
    table: entries,
    column: "place_id",
    expected: ON_DELETE.SET_NULL,
  },
  {
    label: "entryTags.entryId",
    table: entryTags,
    column: "entry_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "entryTags.tagId",
    table: entryTags,
    column: "tag_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "entryPhotos.entryId",
    table: entryPhotos,
    column: "entry_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "entryPhotos.mediaId",
    table: entryPhotos,
    column: "media_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "follows.followerId",
    table: follows,
    column: "follower_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "follows.followeeId",
    table: follows,
    column: "followee_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "notifications.userId",
    table: notifications,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "connectedAccounts.userId",
    table: connectedAccounts,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
  {
    label: "userPreferences.userId",
    table: userPreferences,
    column: "user_id",
    expected: ON_DELETE.CASCADE,
  },
];

describe("ON DELETE policy", () => {
  it.each(ON_DELETE_POLICY)(
    "$label uses ON DELETE $expected",
    ({ table, column, expected }) => {
      expect(onDeleteForColumn(table, column)).toBe(expected);
    },
  );

  it("every foreign key in the schema is single-column", () => {
    const referencingColumnCounts = schemaTables().flatMap((table) =>
      getTableConfig(table).foreignKeys.map(
        (foreignKey) => foreignKey.reference().columns.length,
      ),
    );
    for (const columnCount of referencingColumnCounts) {
      expect(columnCount).toBe(FK_REFERENCING_COLUMN_COUNT);
    }
  });

  it("covers every foreign key in the schema (no FK left unasserted)", () => {
    const schemaForeignKeys = [...foreignKeyIdsFromSchema()].sort();
    const policyForeignKeys = [...foreignKeyIdsFromPolicy()].sort();
    // Set equality (not just count parity): catches an unasserted FK, a
    // duplicate policy entry masking a missing one, and a typo'd column name.
    expect(policyForeignKeys).toEqual(schemaForeignKeys);
  });
});
