import { db } from "./client";
import { rooms, items, exits, room_items } from "./schema";

async function seed() {
  // TODO(Marcus): insert your entrance/cellar world from lib/engine/world.ts.
  //

  await db.delete(exits);
  await db.delete(room_items);
  await db.delete(items);
  await db.delete(rooms);
  // Order matters — insert whatever has no foreign keys first:
  //   1. rooms
  await db.insert(rooms).values([
    {
      id: 'entrance', 
      title: 'Entrance Hall', 
      description: "A cold, dust-sheeted hall. A heavy door leads south.",
    },
    {
      id: 'cellar', 
      title: 'Cellar', 
      description: "Stone steps descend into darkness.", 
    }
  ])
  //   2. items
  await db.insert(items).values([
    {
      id: 'key', 
      name: 'brass key', 
      portable: true,
    },
    {
      id: 'statue', 
      name: 'stone statue', 
      portable: false, 
    },
  ])
  //   3. room_items (needs rooms + items to already exist)
  await db.insert(room_items).values([
    {
      room_id: 'entrance',
      item_id: 'key'
    },
    {
      room_id: 'entrance',
      item_id: 'statue'
    }
  ])
  //   4. exits      (needs rooms, and items for required_item)
  await db.insert(exits).values([
    {
      id: 'entrance_to_cellar',
      from_room_id: 'entrance',
      direction: 'south',
      to_room_id: 'cellar',
      required_item: 'key',
    },
    {
      id: 'cellar_to_entrance',
      from_room_id: 'cellar',
      direction: 'north',
      to_room_id: 'entrance',
      required_item: null,
    },
  ])
  //
  // Shape: db.insert(<table>).values([{ ...one row... }, { ...another... }])
  // — a single object also works if you're only inserting one row.
}

seed()
  .then(() => {
    console.log("Seeded.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
