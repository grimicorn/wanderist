ALTER TABLE "media" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "media_user_source_source_id_unique" ON "media" ("user_id","source","source_id");
