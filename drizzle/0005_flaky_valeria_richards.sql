CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"item_id" text NOT NULL,
	"flag" text NOT NULL,
	"message" text NOT NULL,
	"consume" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exits" ADD COLUMN "required_flag" text;--> statement-breakpoint
ALTER TABLE "exits" ADD COLUMN "locked_message" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "is_ending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;