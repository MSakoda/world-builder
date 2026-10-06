import { describe, expect, it } from "vitest";
import { applyAction } from "../engine/applyAction";
import { DIRECTIONS, type Action, type Direction, type GameState } from "../engine/types";
import { assembleWorld } from "./assemble";
import { worldRows } from "./data";

const world = assembleWorld(worldRows);
const OPPOSITE: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
};

describe("world data", () => {
  it("has the v1 room count (20-25)", () => {
    const count = Object.keys(world.rooms).length;
    expect(count).toBeGreaterThanOrEqual(20);
    expect(count).toBeLessThanOrEqual(25);
  });

  it("has unique room and item ids", () => {
    expect(new Set(worldRows.rooms.map((r) => r.id)).size).toBe(worldRows.rooms.length);
    expect(new Set(worldRows.items.map((i) => i.id)).size).toBe(worldRows.items.length);
  });

  it("only uses known directions, rooms and items", () => {
    for (const room of Object.values(world.rooms)) {
      for (const [dir, exit] of Object.entries(room.exits)) {
        expect(DIRECTIONS as readonly string[], `${room.id} ${dir}`).toContain(dir);
        expect(world.rooms[exit.to], `${room.id} ${dir} -> ${exit.to}`).toBeDefined();
        if (exit.requiredItem) expect(world.items[exit.requiredItem]).toBeDefined();
      }
      for (const id of room.items) expect(world.items[id], `${room.id} has ${id}`).toBeDefined();
    }
  });

  it("every exit has a way back in the opposite direction", () => {
    for (const room of Object.values(world.rooms)) {
      for (const [dir, exit] of Object.entries(room.exits)) {
        const back = world.rooms[exit.to].exits[OPPOSITE[dir as Direction]];
        expect(back?.to, `${room.id} ${dir} -> ${exit.to} has no way back`).toBe(room.id);
      }
    }
  });

  it("every room can be reached from the start, ignoring locks", () => {
    const seen = new Set(["entrance"]);
    const queue = ["entrance"];
    while (queue.length) {
      for (const exit of Object.values(world.rooms[queue.shift()!].exits)) {
        if (!seen.has(exit.to)) {
          seen.add(exit.to);
          queue.push(exit.to);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(world.rooms).sort());
  });

  it("has exactly one ending room", () => {
    expect(Object.values(world.rooms).filter((r) => r.ending)).toHaveLength(1);
  });

  it("every lock can be opened: each required flag is set by an interaction, each required item exists in a room", () => {
    const flagsSet = new Set(world.interactions.map((i) => i.flag));
    const itemsInRooms = new Set(Object.values(world.rooms).flatMap((r) => r.items));
    for (const room of Object.values(world.rooms)) {
      for (const exit of Object.values(room.exits)) {
        if (exit.requiredFlag) expect(flagsSet.has(exit.requiredFlag), exit.requiredFlag).toBe(true);
        if (exit.requiredItem) {
          expect(itemsInRooms.has(exit.requiredItem), exit.requiredItem).toBe(true);
          expect(world.items[exit.requiredItem].portable).toBe(true);
        }
      }
    }
    for (const i of world.interactions) {
      expect(world.rooms[i.roomId]).toBeDefined();
      expect(world.items[i.itemId]?.portable).toBe(true);
    }
  });
});

/** Plays actions through the real engine, failing the test on any refused step. */
function play(actions: Action[], from?: GameState): GameState {
  let state: GameState = from ?? { currentRoom: "entrance", inventory: [], flags: {} };
  for (const action of actions) {
    const out = applyAction(state, action, world);
    expect(out.result.success, `${JSON.stringify(action)} in ${state.currentRoom}: ${out.result.message}`).toBe(true);
    state = out.state;
  }
  return state;
}
const go = (direction: Direction): Action => ({ verb: "go", direction });
const take = (target: string): Action => ({ verb: "take", target });
const applyItem = (target: string): Action => ({ verb: "use", target });

const WALKTHROUGH: Action[] = [
  take("key"),
  go("south"), // cellar
  take("torch"),
  go("north"),
  go("north"), // great hall
  go("west"), // library
  go("west"), // reading nook
  take("rune_stone"),
  go("east"),
  go("east"), // great hall
  go("south"), // entrance
  go("south"), // cellar
  applyItem("rune_stone"), // unseals the crypt
  go("south"), // crypt
  take("iron_key"),
  go("north"),
  go("north"), // entrance
  go("north"), // great hall
  go("up"), // gallery
  applyItem("torch"), // lights the stairwell
  go("up"), // tower stairs
  go("up"), // watch room
  go("up"), // beacon terrace
];

describe("the game is winnable", () => {
  it("the walkthrough reaches the ending and sets the won flag", () => {
    const end = play(WALKTHROUGH);
    expect(end.currentRoom).toBe("beacon_top");
    expect(end.flags.won).toBe(true);
  });

  it("each puzzle really blocks the way until it is solved", () => {
    const refused = (state: GameState, action: Action) =>
      applyAction(state, action, world).result.success === false;

    const atEntrance: GameState = { currentRoom: "entrance", inventory: [], flags: {} };
    expect(refused(atEntrance, go("south"))).toBe(true); // cellar needs the brass key

    const atCellar: GameState = { currentRoom: "cellar", inventory: ["torch"], flags: {} };
    expect(refused(atCellar, go("south"))).toBe(true); // crypt sealed

    const atGallery: GameState = { currentRoom: "gallery", inventory: ["torch"], flags: {} };
    expect(refused(atGallery, go("up"))).toBe(true); // stairwell dark until the torch is used

    const atWatch: GameState = { currentRoom: "watch_room", inventory: [], flags: {} };
    expect(refused(atWatch, go("up"))).toBe(true); // gate needs the iron key
  });

  it("using the torch uses it up, and the rune stone stays", () => {
    const gallery = play([applyItem("torch")], { currentRoom: "gallery", inventory: ["torch"], flags: {} });
    expect(gallery.inventory).not.toContain("torch");
    expect(gallery.flags.stairs_lit).toBe(true);

    const cellar = play([applyItem("rune_stone")], { currentRoom: "cellar", inventory: ["rune_stone"], flags: {} });
    expect(cellar.inventory).toContain("rune_stone");
    expect(cellar.flags.crypt_unsealed).toBe(true);
  });
});
