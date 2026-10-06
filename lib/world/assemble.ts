import type { Direction, Interaction, Item, Room, World } from "../engine/types";

// Row shapes as stored in Postgres (see lib/db/schema.ts).
export type WorldRows = {
  rooms: { id: string; title: string; description: string; is_ending: boolean }[];
  items: { id: string; name: string; portable: boolean }[];
  room_items: { room_id: string; item_id: string }[];
  exits: {
    from_room_id: string;
    direction: string;
    to_room_id: string;
    required_item: string | null;
    required_flag: string | null;
    locked_message: string | null;
  }[];
  interactions: {
    room_id: string;
    item_id: string;
    flag: string;
    message: string;
    consume: boolean;
  }[];
};

/**
 * Reassembles the World the engine runs on from flat table rows. Pure, so the
 * same code builds the world for the game, the seed check, and the tests.
 * Postgres NULL becomes "absent" so the engine only sees real values.
 */
export function assembleWorld(rows: WorldRows): World {
  const items: Record<string, Item> = {};
  for (const item of rows.items) items[item.id] = { ...item };

  const itemsByRoom: Record<string, string[]> = {};
  for (const { room_id, item_id } of rows.room_items) {
    (itemsByRoom[room_id] ??= []).push(item_id);
  }

  const exitsByRoom: Record<string, Room["exits"]> = {};
  for (const e of rows.exits) {
    (exitsByRoom[e.from_room_id] ??= {})[e.direction as Direction] = {
      to: e.to_room_id,
      ...(e.required_item ? { requiredItem: e.required_item } : {}),
      ...(e.required_flag ? { requiredFlag: e.required_flag } : {}),
      ...(e.locked_message ? { lockedMessage: e.locked_message } : {}),
    };
  }

  const roomsById: Record<string, Room> = {};
  for (const r of rows.rooms) {
    roomsById[r.id] = {
      id: r.id,
      title: r.title,
      description: r.description,
      items: itemsByRoom[r.id] ?? [],
      exits: exitsByRoom[r.id] ?? {},
      ...(r.is_ending ? { ending: true } : {}),
    };
  }

  const interactions: Interaction[] = rows.interactions.map((i) => ({
    roomId: i.room_id,
    itemId: i.item_id,
    flag: i.flag,
    message: i.message,
    ...(i.consume ? { consume: true } : {}),
  }));

  return { rooms: roomsById, items, interactions };
}
