export type Direction = "north" | "south";

export type Item = {
  id: string;
  name: string;
  portable: boolean;
};

export type Room = {
  id: string;
  title: string;
  description: string;
  items: string[]; // item ids currently in the room
  exits: Partial<Record<Direction, { to: string; requiredItem?: string }>>;
};

export type World = {
  rooms: Record<string, Room>;
  items: Record<string, Item>;
};

export type GameState = {
  currentRoom: string;
  inventory: string[];
  flags: Record<string, boolean>;
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
