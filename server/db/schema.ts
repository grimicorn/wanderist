// fallow-ignore-file code-duplication
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enum definitions — exported so app code can reference them without
// magic strings.
// ---------------------------------------------------------------------------

export const TRIP_STATUS = {
  ONGOING: "ongoing",
  UPCOMING: "upcoming",
  PAST: "past",
} as const;

export const VISIBILITY = {
  PRIVATE: "private",
  PUBLIC: "public",
} as const;

export const TRIP_STOP_STATUS = {
  DONE: "done",
  NEXT: "next",
  PLANNED: "planned",
} as const;

export const CONNECTED_ACCOUNT_PROVIDER = {
  INSTAGRAM: "instagram",
  GOOGLE: "google",
} as const;

export const DISTANCE_UNIT = {
  MI: "mi",
  KM: "km",
} as const;

// Referential actions for foreign keys — named so call sites and tests share
// one source of truth instead of repeating the raw Postgres action strings.
export const ON_DELETE = {
  CASCADE: "cascade",
  SET_NULL: "set null",
} as const;

export const tripStatusEnum = pgEnum("trip_status", [
  TRIP_STATUS.ONGOING,
  TRIP_STATUS.UPCOMING,
  TRIP_STATUS.PAST,
]);

export const visibilityEnum = pgEnum("visibility", [
  VISIBILITY.PRIVATE,
  VISIBILITY.PUBLIC,
]);

export const tripStopStatusEnum = pgEnum("trip_stop_status", [
  TRIP_STOP_STATUS.DONE,
  TRIP_STOP_STATUS.NEXT,
  TRIP_STOP_STATUS.PLANNED,
]);

export const connectedAccountProviderEnum = pgEnum(
  "connected_account_provider",
  [CONNECTED_ACCOUNT_PROVIDER.INSTAGRAM, CONNECTED_ACCOUNT_PROVIDER.GOOGLE],
);

export const distanceUnitEnum = pgEnum("distance_unit", [
  DISTANCE_UNIT.MI,
  DISTANCE_UNIT.KM,
]);

// ---------------------------------------------------------------------------
// users — Clerk user ID as PK (text), kept from existing schema.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  // Soft-delete: stamped with the deletion-request time. A scheduled job purges
  // the row (and all FK CASCADE children) once `deletedAt + grace_period < now`.
  deletedAt: timestamp("deleted_at"),
});

// ---------------------------------------------------------------------------
// media — minimal table referenced as FK by trips and entry_photos.
// Stores provider-agnostic references (url/storage key) to uploaded files.
// ---------------------------------------------------------------------------

export const MEDIA_SOURCE = {
  INSTAGRAM: "instagram",
} as const;

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    url: text("url").notNull(),
    // Optional metadata; null until a future image-processing step populates them.
    // Columns are reserved so consumers (e.g. <AppImage>) can prevent layout shift.
    width: integer("width"),
    height: integer("height"),
    contentType: text("content_type"),
    // Import idempotency: records which external service produced this media row
    // and the provider-assigned ID for it. Nullable so pre-existing rows are
    // unaffected. A unique index on (user_id, source, source_id) prevents the
    // same external item from being imported twice for the same user.
    source: text("source"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_user_id_idx").on(table.userId),
    unique("media_user_source_source_id_unique").on(
      table.userId,
      table.source,
      table.sourceId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// places
// ---------------------------------------------------------------------------

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    country: text("country"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    category: text("category"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("places_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// trips
// ---------------------------------------------------------------------------

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    name: text("name").notNull(),
    status: tripStatusEnum("status").notNull().default(TRIP_STATUS.UPCOMING),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    coverImageId: text("cover_image_id").references(() => media.id, {
      onDelete: ON_DELETE.SET_NULL,
    }),
    distanceKm: doublePrecision("distance_km"),
    visibility: visibilityEnum("visibility")
      .notNull()
      .default(VISIBILITY.PRIVATE),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("trips_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// trip_stops
// ---------------------------------------------------------------------------

export const tripStops = pgTable(
  "trip_stops",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: ON_DELETE.CASCADE }),
    placeId: text("place_id").references(() => places.id, {
      onDelete: ON_DELETE.SET_NULL,
    }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    arriveDate: timestamp("arrive_date"),
    nights: integer("nights"),
    note: text("note"),
    distanceKm: doublePrecision("distance_km"),
    status: tripStopStatusEnum("status")
      .notNull()
      .default(TRIP_STOP_STATUS.PLANNED),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("trip_stops_trip_id_idx").on(table.tripId),
    index("trip_stops_place_id_idx").on(table.placeId),
  ],
);

// ---------------------------------------------------------------------------
// entries — journal entries
// ---------------------------------------------------------------------------

export const entries = pgTable(
  "entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    tripId: text("trip_id").references(() => trips.id, {
      onDelete: ON_DELETE.SET_NULL,
    }),
    placeId: text("place_id").references(() => places.id, {
      onDelete: ON_DELETE.SET_NULL,
    }),
    title: text("title").notNull(),
    body: text("body"),
    occurredAt: timestamp("occurred_at"),
    visibility: visibilityEnum("visibility")
      .notNull()
      .default(VISIBILITY.PRIVATE),
    weather: text("weather"),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("entries_user_id_idx").on(table.userId),
    index("entries_trip_id_idx").on(table.tripId),
    index("entries_place_id_idx").on(table.placeId),
  ],
);

// ---------------------------------------------------------------------------
// tags + entry_tags join table
// Normalized rather than inline text array so queries like "all entries tagged
// 'hiking'" stay efficient without full-table scans.
// ---------------------------------------------------------------------------

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const entryTags = pgTable(
  "entry_tags",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: ON_DELETE.CASCADE }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: ON_DELETE.CASCADE }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.tagId] }),
    // PK (entry_id, tag_id) already covers lookups by entry_id via leftmost-prefix.
    // Add tag_id index to support "all entries for tag X" queries efficiently.
    index("entry_tags_tag_id_idx").on(table.tagId),
  ],
);

// ---------------------------------------------------------------------------
// entry_photos
// ---------------------------------------------------------------------------

export const entryPhotos = pgTable(
  "entry_photos",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: ON_DELETE.CASCADE }),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: ON_DELETE.CASCADE }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("entry_photos_entry_id_idx").on(table.entryId)],
);

// ---------------------------------------------------------------------------
// follows
// ---------------------------------------------------------------------------

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    // Index on followee_id to support "who follows user X" queries efficiently.
    // The PK (follower_id, followee_id) covers "who does X follow" via leftmost-prefix.
    index("follows_followee_id_idx").on(table.followeeId),
    check(
      "follows_no_self_follow",
      sql`${table.followerId} <> ${table.followeeId}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    type: text("type").notNull(),
    tone: text("tone"),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// connected_accounts
// Access tokens are stored as ciphertext — encryption/decryption is handled
// at the application layer before writes and after reads.
// ---------------------------------------------------------------------------

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    provider: connectedAccountProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    accessToken: text("access_token"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
  },
  (table) => [
    index("connected_accounts_user_id_idx").on(table.userId),
    // Prevent the same external account from being linked to two different users.
    unique("connected_accounts_provider_external_id_unique").on(
      table.provider,
      table.externalId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// guides — curated travel guides authored by Wanderist users.
// A guide is a standalone editorial piece (not a trip) with a title, author,
// and a read-time estimate. The `likeCount` is denormalised for fast ranking
// on the explore page without a join to a likes table.
// ---------------------------------------------------------------------------

export const guides = pgTable(
  "guides",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
    title: text("title").notNull(),
    body: text("body"),
    readTimeMinutes: integer("read_time_minutes").notNull().default(5),
    likeCount: integer("like_count").notNull().default(0),
    visibility: visibilityEnum("visibility")
      .notNull()
      .default(VISIBILITY.PRIVATE),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("guides_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// user_preferences — 1:1 with users, userId is PK
// ---------------------------------------------------------------------------

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: ON_DELETE.CASCADE }),
  distanceUnit: distanceUnitEnum("distance_unit")
    .notNull()
    .default(DISTANCE_UNIT.MI),
  defaultMapStyle: text("default_map_style"),
  publicProfile: boolean("public_profile").notNull().default(false),
  preciseLocation: boolean("precise_location").notNull().default(false),
  showOnExplore: boolean("show_on_explore").notNull().default(true),
  displayName: text("display_name"),
  handle: text("handle").unique(),
  homeBase: text("home_base"),
  bio: text("bio"),
});
