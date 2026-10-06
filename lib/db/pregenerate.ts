import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { generations } from "./schema";
import { loadWorld } from "./loadWorld";
import { PROSE_MODEL, generateRoomProse } from "../ai/generateRoomProse";

/**
 * Generates and caches AI prose for every room that doesn't have it yet, so
 * players don't spend their per-session cap exploring the map.
 *
 *   npm run db:prose            only rooms with no cached prose
 *   npm run db:prose -- --force regenerate every room (after editing the world)
 */
async function main() {
  const force = process.argv.includes("--force");
  const world = await loadWorld();
  const roomIds = Object.keys(world.rooms);

  if (force) await db.delete(generations).where(inArray(generations.room_id, roomIds));

  let made = 0;
  let failed = 0;
  for (const id of roomIds) {
    const existing = await db.select({ id: generations.id }).from(generations).where(eq(generations.room_id, id)).limit(1);
    if (existing.length) continue;

    const prose = await generateRoomProse(world.rooms[id]);
    if (!prose) {
      failed++;
      console.log(`  ${id}: FAILED (will fall back to the written description)`);
      continue;
    }
    await db.insert(generations).values({
      room_id: id,
      model: PROSE_MODEL,
      prose: prose.prose,
      mood: prose.mood,
      referenced_items: prose.referencedItems,
    });
    made++;
    console.log(`  ${id}: ok (${prose.mood})`);
    await new Promise((r) => setTimeout(r, 400)); // be gentle with provider rate limits
  }
  console.log(`Generated ${made}, failed ${failed}, ${roomIds.length} rooms total.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
