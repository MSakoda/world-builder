import type { Direction } from "../engine/types";
import type { WorldRows } from "./assemble";

/**
 * The hand-authored world. This file is the source of truth: `npm run db:seed`
 * writes it to Postgres, and lib/world/world.test.ts checks it is consistent
 * and winnable. Edit rooms, items and puzzles here.
 *
 * The goal: light the beacon on top of the tower.
 *   brass key  -> opens the cellar
 *   rune stone -> used in the cellar, unseals the crypt (iron key is inside)
 *   torch      -> used in the gallery, lights the tower stairwell
 *   iron key   -> opens the gate to the beacon
 */

const OPPOSITE: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
};

type Lock = { item?: string; flag?: string; message?: string };

const rooms: WorldRows["rooms"] = [];
const exits: WorldRows["exits"] = [];
const roomItems: WorldRows["room_items"] = [];

function room(id: string, title: string, description: string, itemIds: string[] = [], ending = false) {
  rooms.push({ id, title, description, is_ending: ending });
  for (const item_id of itemIds) roomItems.push({ room_id: id, item_id });
}

/** `lock` applies to the way in (from -> to); the way back is always open. */
function link(from: string, direction: Direction, to: string, lock: Lock = {}) {
  exits.push({
    from_room_id: from,
    direction,
    to_room_id: to,
    required_item: lock.item ?? null,
    required_flag: lock.flag ?? null,
    locked_message: lock.message ?? null,
  });
  exits.push({
    from_room_id: to,
    direction: OPPOSITE[direction],
    to_room_id: from,
    required_item: null,
    required_flag: null,
    locked_message: null,
  });
}

// ---- ground floor ---------------------------------------------------------
room("entrance", "Entrance Hall", "A cold, dust-sheeted hall. A heavy door leads south.", ["key", "statue"]);
room("courtyard", "Courtyard", "A windswept courtyard of cracked flagstones. Dead ivy clings to the keep wall.");
room("well_house", "Well House", "A tiny stone shelter built over a dry well. The rope has long since rotted.", ["bucket"]);
room("great_hall", "Great Hall", "A vast hall under a blackened ceiling. A faded tapestry hangs over a cold hearth.", ["tapestry"]);
room("dining_hall", "Dining Hall", "A long table still set for a feast no one ate. Cobwebs drape the chairs.", ["candlestick"]);
room("pantry", "Pantry", "Empty shelves and the sour smell of old grain.");
room("library", "Library", "Tall shelves of crumbling books. A narrow door stands to the north and an alcove opens west.");
room("study", "Study", "A cramped study, its desk buried in loose papers.", ["ledger"]);
room("reading_nook", "Reading Nook", "A curtained alcove with a moth-eaten cushion. Something glints in the dust.", ["rune_stone"]);
room("kitchen", "Kitchen", "A soot-stained kitchen with a hearth big enough to roast an ox.");
room("scullery", "Scullery", "A damp little room of stone sinks and hanging copper pots.");

// ---- cellar level ---------------------------------------------------------
room("cellar", "Cellar", "Stone steps descend into darkness. Passages lead east and west, and a slab of black stone seals the south.", ["torch"]);
room("wine_vault", "Wine Vault", "Rack after rack of dusty bottles, most of them long since turned to vinegar.", ["wine_bottle"]);
room("cistern", "Cistern", "A low vault holding a pool of black, perfectly still water.");
room("crypt", "Crypt", "A cold crypt. A single stone sarcophagus lies at its center, its lid cracked.", ["iron_key", "sarcophagus"]);

// ---- upper floor ----------------------------------------------------------
room("gallery", "Gallery", "A long balcony above the hall. Doors lead north, east and west, and a dark stairwell climbs up.");
room("bedchamber", "Bedchamber", "A great canopied bed, its curtains rotted to rags.");
room("chapel", "Chapel", "A small chapel. Pale light falls on a cracked altar.", ["altar", "prayer_book"]);
room("armory", "Armory", "Racks of rusted weapons line the walls.", ["rusty_sword"]);

// ---- the tower ------------------------------------------------------------
room("tower_stairs", "Tower Stairs", "A narrow spiral stair, lit now by the torch in its sconce.");
room("watch_room", "Watch Room", "A round room of arrow slits looking out over the dark hills. A grated gate leads up.");
room(
  "beacon_top",
  "Beacon Terrace",
  "Open sky above a great iron brazier. As you set your light to it, the whole hilltop flares gold, and the keep, long dark, is lit again.",
  [],
  true,
);

// ---- connections ----------------------------------------------------------
link("entrance", "north", "great_hall");
link("entrance", "east", "courtyard");
link("entrance", "south", "cellar", { item: "key" });
link("courtyard", "north", "well_house");
link("great_hall", "east", "dining_hall");
link("great_hall", "west", "library");
link("great_hall", "north", "kitchen");
link("great_hall", "up", "gallery");
link("dining_hall", "east", "pantry");
link("library", "north", "study");
link("library", "west", "reading_nook");
link("kitchen", "east", "scullery");
link("cellar", "east", "wine_vault");
link("cellar", "west", "cistern");
link("cellar", "south", "crypt", {
  flag: "crypt_unsealed",
  message: "A slab of black stone seals the passage. Faint runes ring its edge.",
});
link("gallery", "north", "bedchamber");
link("gallery", "east", "chapel");
link("gallery", "west", "armory");
link("gallery", "up", "tower_stairs", {
  flag: "stairs_lit",
  message: "The stairwell is pitch dark. You can't risk the climb without a light.",
});
link("tower_stairs", "up", "watch_room");
link("watch_room", "up", "beacon_top", {
  item: "iron_key",
  message: "An iron gate bars the way to the beacon. It needs a key.",
});

export const worldRows: WorldRows = {
  rooms,
  items: [
    { id: "key", name: "brass key", portable: true },
    { id: "statue", name: "stone statue", portable: false },
    { id: "torch", name: "pitch-soaked torch", portable: true },
    { id: "rune_stone", name: "carved rune stone", portable: true },
    { id: "iron_key", name: "iron key", portable: true },
    { id: "candlestick", name: "tarnished candlestick", portable: true },
    { id: "wine_bottle", name: "dusty wine bottle", portable: true },
    { id: "rusty_sword", name: "rusty sword", portable: true },
    { id: "prayer_book", name: "moldy prayer book", portable: true },
    { id: "ledger", name: "water-stained ledger", portable: true },
    { id: "bucket", name: "leaky bucket", portable: true },
    { id: "tapestry", name: "faded tapestry", portable: false },
    { id: "sarcophagus", name: "stone sarcophagus", portable: false },
    { id: "altar", name: "cracked altar", portable: false },
  ],
  room_items: roomItems,
  exits,
  interactions: [
    {
      room_id: "cellar",
      item_id: "rune_stone",
      flag: "crypt_unsealed",
      message:
        "You press the rune stone to the black slab. The runes flare ember-red and the stone grinds aside, opening a passage south.",
      consume: false,
    },
    {
      room_id: "gallery",
      item_id: "torch",
      flag: "stairs_lit",
      message:
        "You wedge the torch into an iron sconce at the foot of the tower stairs. Flame crawls up the pitch and the stairwell glows.",
      consume: true,
    },
  ],
};
