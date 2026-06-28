ALTER TABLE "media" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_user_source_source_id_unique" UNIQUE("user_id","source","source_id");
