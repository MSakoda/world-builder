export const DIRECTIONS = ["north", "south", "east", "west", "up", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type Item = {
  id: string;
  name: string;
  portable: boolean;
};

export type Exit = {
  to: string;
  requiredItem?: string; // must be carrying this item to pass
  requiredFlag?: string; // must have set this flag (see Interaction) to pass
  lockedMessage?: string; // shown when the exit is blocked
};

export type Room = {
  id: string;
  title: string;
  description: string;
  items: string[]; // item ids currently in the room
  exits: Partial<Record<Direction, Exit>>;
  ending?: boolean; // reaching this room wins the game
};

// Using `itemId` in `roomId` sets `flag` (and optionally uses the item up).
export type Interaction = {
  roomId: string;
  itemId: string;
  flag: string;
  message: string;
  consume?: boolean;
};

export type World = {
  rooms: Record<string, Room>;
  items: Record<string, Item>;
  interactions: Interaction[];
};

export type GameState = {
  currentRoom: string;
  inventory: string[];
  flags: Record<string, boolean>; // includes "won" once an ending room is reached
};

export type Action =
  | { verb: "go"; direction: Direction }
  | { verb: "take"; target: string }
  | { verb: "use"; target: string }
  | { verb: "look" };

export type ActionResult = {
  success: boolean;
  message: string;
};
