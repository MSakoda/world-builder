import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { generations } from "../db/schema";
import type { Room } from "../engine/types";
import { PROSE_MODEL, fallbackProse, generateRoomProse, type RoomProse } from "./generateRoomProse";

const MOODS = ["tense", "calm", "eerie"] as const;

/**
 * Latest cached prose for a room; generates (and caches) it on a miss.
 * Never throws: on any failure it returns the plain room description.
 */
export async function getRoomProse(room: Room): Promise<RoomProse> {
  try {
    const [cached] = await db
      .select()
      .from(generations)
      .where(eq(generations.room_id, room.id))
      .orderBy(desc(generations.created_at))
      .limit(1);
    if (cached && (MOODS as readonly string[]).includes(cached.mood)) {
      return {
        prose: cached.prose,
        mood: cached.mood as RoomProse["mood"],
        referencedItems: cached.referenced_items as string[],
      };
    }

    const fresh = await generateRoomProse(room);
    if (!fresh) return fallbackProse(room);

    await db.insert(generations).values({
      room_id: room.id,
      model: PROSE_MODEL,
      prose: fresh.prose,
      mood: fresh.mood,
      referenced_items: fresh.referencedItems,
    });
    return fresh;
  } catch (err) {
    console.error("getRoomProse failed:", err);
    return fallbackProse(room);
  }
}
