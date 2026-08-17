import { getOrCreateSessionId } from "../lib/session";
import { getOrCreateRun } from "../lib/db/getOrCreateRun";
import { loadWorld } from "../lib/db/loadWorld";
import GameView from "./GameView";
import type { GameState } from "../lib/engine/types";

export default async function Home() {
  const sessionId = await getOrCreateSessionId();
  const run = await getOrCreateRun(sessionId);
  const world = await loadWorld();

  const initialState: GameState = {
    currentRoom: run.current_room_id,
    inventory: run.inventory as string[],
    flags: run.flags as Record<string, boolean>,
  };

  return (
    <main>
      <GameView initialState={initialState} world={world} />
    </main>
  );
}
