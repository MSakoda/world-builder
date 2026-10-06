import { sql } from "drizzle-orm";
import { db } from "./client";
import { rooms, items, exits, room_items, interactions } from "./schema";
import { worldRows } from "../world/data";

/**
 * Writes lib/world/data.ts to Postgres without wiping anything players depend on.
 *
 * - rooms and items are upserted, never deleted: runs point at rooms by id.
 * - exits, room_items and interactions are only referenced by nothing else,
 *   so they are replaced wholesale, in one transaction.
 * Safe to run any number of times.
 */
async function seed() {
  await db.transaction(async (tx) => {
    await tx
      .insert(rooms)
      .values(worldRows.rooms)
      .onConflictDoUpdate({
        target: rooms.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          is_ending: sql`excluded.is_ending`,
        },
      });
    await tx
      .insert(items)
      .values(worldRows.items)
      .onConflictDoUpdate({
        target: items.id,
        set: { name: sql`excluded.name`, portable: sql`excluded.portable` },
      });

    await tx.delete(exits);
    await tx.delete(room_items);
    await tx.delete(interactions);
    await tx.insert(room_items).values(worldRows.room_items);
    await tx
      .insert(exits)
      .values(worldRows.exits.map((e) => ({ ...e, id: `${e.from_room_id}_${e.direction}` })));
    await tx
      .insert(interactions)
      .values(
        worldRows.interactions.map((i) => ({ ...i, id: `${i.room_id}_${i.item_id}` })),
      );
  });

  const known = new Set(worldRows.rooms.map((r) => r.id));
  const inDb = await db.select({ id: rooms.id }).from(rooms);
  const orphans = inDb.filter((r) => !known.has(r.id)).map((r) => r.id);
  console.log(
    `Seeded ${worldRows.rooms.length} rooms, ${worldRows.items.length} items, ` +
      `${worldRows.exits.length} exits, ${worldRows.interactions.length} interactions.`,
  );
  if (orphans.length) console.log(`Rooms in the database but not in data.ts (left alone): ${orphans.join(", ")}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
