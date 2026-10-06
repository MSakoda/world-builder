"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db/client";
import { generations } from "../db/schema";
import type { RoomProse } from "./generateRoomProse";

/**
 * Saves a finished generation and refreshes the page that lists them.
 *
 * Only server code (the prose stream route) imports this, so Next gives it no
 * public endpoint. Keep it that way: it takes prose as an argument, so if a
 * client component ever imported it, anyone could write text into the cache.
 */
export async function saveGeneration(roomId: string, model: string, prose: RoomProse) {
  await db.insert(generations).values({
    room_id: roomId,
    model,
    prose: prose.prose,
    mood: prose.mood,
    referenced_items: prose.referencedItems,
  });
  // The row is saved; a revalidation hiccup must not make the generation look failed.
  try {
    revalidatePath("/worlds");
  } catch (err) {
    console.error("revalidatePath failed after saving generation:", err);
  }
}
