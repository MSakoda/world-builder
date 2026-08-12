import type { GameState, World } from "./types";

// Deliberately tiny for M1: just enough rooms and items to exercise
// applyAction's rules. This gets replaced by Postgres in M2 — the engine
// functions should not need to change when that happens.
export const world: World = {
  rooms: {
    entrance: {
      id: "entrance",
      title: "Entrance Hall",
      description: "A cold, dust-sheeted hall. A heavy door leads south.",
      items: ["key", "statue"],
      exits: {
        south: { to: "cellar", requiredItem: "key" },
      },
    },
    cellar: {
      id: "cellar",
      title: "Cellar",
      description: "Stone steps descend into darkness.",
      items: [],
      exits: {
        north: { to: "entrance" },
      },
    },
  },
  items: {
    key: { id: "key", name: "brass key", portable: true },
    statue: { id: "statue", name: "stone statue", portable: false },
  },
};

export function initialState(): GameState {
  return {
    currentRoom: "entrance",
    inventory: [],
    flags: {},
  };
}
