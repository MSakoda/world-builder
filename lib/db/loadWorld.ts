import { db } from "./client";
import { rooms, items, exits, room_items, interactions } from "./schema";
import { assembleWorld } from "../world/assemble";
import type { World } from "../engine/types";

/** Loads the world from Postgres; the engine does not care where it came from. */
export async function loadWorld(): Promise<World> {
  const [roomRows, itemRows, roomItemRows, exitRows, interactionRows] = await Promise.all([
    db.select().from(rooms),
    db.select().from(items),
    db.select().from(room_items),
    db.select().from(exits),
    db.select().from(interactions),
  ]);
  return assembleWorld({
    rooms: roomRows,
    items: itemRows,
    room_items: roomItemRows,
    exits: exitRows,
    interactions: interactionRows,
  });
}
