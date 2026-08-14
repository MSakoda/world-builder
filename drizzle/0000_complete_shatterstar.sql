CREATE TABLE "exits" (
	"id" text PRIMARY KEY NOT NULL,
	"from_room_id" text NOT NULL,
	"direction" text NOT NULL,
	"to_room_id" text NOT NULL,
	"required_item" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"portable" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_items" (
	"room_id" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "room_items_room_id_item_id_pk" PRIMARY KEY("room_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exits" ADD CONSTRAINT "exits_from_room_id_rooms_id_fk" FOREIGN KEY ("from_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exits" ADD CONSTRAINT "exits_to_room_id_rooms_id_fk" FOREIGN KEY ("to_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exits" ADD CONSTRAINT "exits_required_item_items_id_fk" FOREIGN KEY ("required_item") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_items" ADD CONSTRAINT "room_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_items" ADD CONSTRAINT "room_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;