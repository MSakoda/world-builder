CREATE TABLE "generation_locks" (
	"room_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_locks" ADD CONSTRAINT "generation_locks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;