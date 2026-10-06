import { db } from "../db/client";
import { generations } from "../db/schema";
import type { RoomProse } from "./generateRoomProse";

/** Saves a finished generation to the cache that /api/prose/stream reads from. */
export async function saveGeneration(roomId: string, model: string, prose: RoomProse) {
  await db.insert(generations).values({
    room_id: roomId,
    model,
    prose: prose.prose,
    mood: prose.mood,
    referenced_items: prose.referencedItems,
  });
}
