import { eq } from "drizzle-orm";
import { db } from "../../../lib/db/client";
import { runs } from "../../../lib/db/schema";
import { getOrCreateRun, STARTING_ROOM_ID } from "../../../lib/db/getOrCreateRun";
import { getOrCreateSessionId } from "../../../lib/session";
import type { GameState } from "../../../lib/engine/types";

/**
 * Starts the player's run over. Position, inventory and flags reset; the
 * session's AI generation count deliberately does not, or restarting would be
 * a way around the per-session cap.
 */
export async function POST() {
  const run = await getOrCreateRun(await getOrCreateSessionId());
  await db
    .update(runs)
    .set({ current_room_id: STARTING_ROOM_ID, inventory: [], flags: {}, last_action_at: new Date() })
    .where(eq(runs.id, run.id));
  const state: GameState = { currentRoom: STARTING_ROOM_ID, inventory: [], flags: {} };
  return Response.json({ state });
}
