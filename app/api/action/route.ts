import { eq } from "drizzle-orm";
import { db } from "../../../lib/db/client";
import { runs } from "../../../lib/db/schema";
import { loadWorld } from "../../../lib/db/loadWorld";
import { getOrCreateSessionId } from "../../../lib/session";
import { getOrCreateRun } from "../../../lib/db/getOrCreateRun";
import { applyAction } from "../../../lib/engine/applyAction";
import type { Action, GameState } from "../../../lib/engine/types";
import { generateRoomProse } from "@/lib/ai/generateRoomProse";

export async function POST(request: Request) {
  const action = (await request.json()) as Action;

  const sessionId = await getOrCreateSessionId();
  const run = await getOrCreateRun(sessionId);
  const world = await loadWorld();

  // (Marcus): inside a single db.transaction(async (tx) => { ... }):
  //
  const txResult = await db.transaction( async (tx) => {
  // 1. Re-read this run's row with tx.select()...from(runs)
  //    .where(eq(runs.id, run.id)).for("update") — locks the row for
  //    the rest of the transaction, so a second concurrent request for
  //    the same run has to wait instead of racing.
  //
    const lockedRuns = await tx.select().from(runs)
      .where(eq(runs.id, run.id)).for("update")
    const locked = lockedRuns.length > 0 ? lockedRuns[0] : null;
    if( !locked ) return;

  // 2. Build a GameState from the locked row:
  //      currentRoom: locked.current_room_id,
  //      inventory: locked.inventory as string[],
  //      flags: locked.flags as Record<string, boolean>,
  //    (jsonb columns come back typed `unknown` — that's why the casts.)
  //
    const gameState : GameState = {
      currentRoom: locked.current_room_id,
      inventory: locked.inventory as string[],
      flags: locked.flags as Record<string, boolean>
    }
  // 3. Call applyAction(state, action, world) — same pure function from
  //    M1, completely unchanged.
  //
    const result = applyAction(gameState, action, world)
    if( !result.result.success) {
      return result;
    }
  // 4. Write the new state back with tx.update(runs).set({
  //      current_room_id: ..., inventory: ..., flags: ...,
  //      last_action_at: new Date(),
  //    }).where(eq(runs.id, locked.id))
  //
  const { currentRoom, inventory, flags } = result.state;
  await tx.update(runs).set({
      current_room_id: currentRoom,
      inventory,
      flags,
      last_action_at: new Date(),
    }).where(eq(runs.id, locked.id))
  // 5. Return { result, state } from the transaction callback, and
  //    respond with Response.json(...) using what the transaction gave back.
  await generateRoomProse(world.rooms[result.state.currentRoom])
  return { result: result.result, state: result.state };
  });
  return Response.json(txResult);
}
