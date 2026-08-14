import { db } from "./client";
import { rooms, items, exits, room_items } from "./schema";
import type { World, Room, Item, Direction } from "../engine/types";

/**
 * Reassembles the World shape lib/engine/world.ts used to hardcode,
 * but sourced from Postgres instead. applyAction should not need to
 * change at all to accept whatever this returns.
 */
export async function loadWorld(): Promise<World> {
  const roomRows = await db.select().from(rooms);
  const itemRows = await db.select().from(items);
  const roomItemRows = await db.select().from(room_items);
  const exitRows = await db.select().from(exits);
  const world : World = {
    rooms: {},
    items: {}
  }

  // (Marcus):
  // 1. Build `world.items` — a Record<string, Item> keyed by item id,
  //    straight from itemRows.
  //
  itemRows.forEach( item => {
    world.items[item.id] = {...item}; 
  })
  // 2. Group roomItemRows by room_id, so you can look up "which item
  //    ids belong to this room" without scanning the whole array once
  //    per room.
  //
  const roomItemsRecord : Record<string, string[]>= {};
  roomItemRows.forEach( roomItemRow => {
    const {room_id, item_id} = roomItemRow;
    roomItemsRecord[room_id] = roomItemsRecord[room_id] ? [...roomItemsRecord[room_id], item_id] : [ item_id ];
  })

  // 3. Group exitRows by from_room_id the same way, and for each one
  //    turn { direction, to_room_id, required_item } into the
  //    Room["exits"] shape: Partial<Record<Direction, { to; requiredItem? }>>.
  //    Careful: required_item is `string | null` from Postgres, but
  //    Room["exits"][dir].requiredItem is `string | undefined` — those
  //    aren't the same value, even though both mean "no key needed."
  //
  const exitsFromRoomRecord : Record<string, Partial<Record<Direction, { to: string; requiredItem?: string }>>> = {};
  exitRows.forEach( exitRow => {
    const { direction, from_room_id, to_room_id, required_item } = exitRow;
    exitsFromRoomRecord[from_room_id] = { 
      ...exitsFromRoomRecord[from_room_id], 
      [direction]: {
        to: to_room_id, 
        ...(required_item ? {requiredItem : required_item } : {} ),
      }
    }
//    and exits out of the two groupings from steps 2-3.
  })
  roomRows.forEach(room => {
    world.rooms[room.id] = {
      ...room, 
      items: roomItemsRecord[room.id] ? roomItemsRecord[room.id] : [], 
      exits: exitsFromRoomRecord[room.id] ?? {}
    };
  })
  return world;
}