ALTER TABLE "trip_stops" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "trip_stops" SET "created_at" = "trips"."created_at" FROM "trips" WHERE "trip_stops"."trip_id" = "trips"."id";
