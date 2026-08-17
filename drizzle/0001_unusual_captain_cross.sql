CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"current_room_id" text NOT NULL,
	"inventory" jsonb NOT NULL,
	"flags" jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_action_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "runs_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_current_room_id_rooms_id_fk" FOREIGN KEY ("current_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;