import { getSessionId } from "../lib/session";
import { getOrCreateRun, STARTING_ROOM_ID } from "../lib/db/getOrCreateRun";
import { loadWorld } from "../lib/db/loadWorld";
import { remainingGenerations } from "../lib/ai/generationQuota";
import { MAX_GENERATIONS_PER_SESSION } from "../lib/ai/limits";
import GameView from "./GameView";
import type { GameState } from "../lib/engine/types";

export default async function Home() {
  const sessionId = await getSessionId();
  const world = await loadWorld();

  let initialState: GameState;
  let initialRemaining = MAX_GENERATIONS_PER_SESSION;
  if (sessionId) {
    const run = await getOrCreateRun(sessionId);
    initialRemaining = await remainingGenerations(sessionId);
    initialState = {
      currentRoom: run.current_room_id,
      inventory: run.inventory as string[],
      flags: run.flags as Record<string, boolean>,
    };
  } else {
    // Brand-new visitor, no cookie yet. Render the starting state without
    // touching the database or setting a cookie — Server Components can't
    // set cookies. The real session and run get created the moment this
    // visitor takes their first action, inside /api/action.
    initialState = { currentRoom: STARTING_ROOM_ID, inventory: [], flags: {} };
  }

  return (
    <main>
      <GameView initialState={initialState} world={world} initialRemaining={initialRemaining} />
    </main>
  );
}
