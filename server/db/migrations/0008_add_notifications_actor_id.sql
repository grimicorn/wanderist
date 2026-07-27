ALTER TABLE "notifications" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_actor_id_idx" ON "notifications" USING btree ("actor_id");
