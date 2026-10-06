import { pgTable, text, boolean, integer, primaryKey, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";

// (Marcus): define rooms, exits, items, room_items.
//
// rooms:      id (text pk, e.g. "entrance"), title, description
export const rooms = pgTable("rooms", {
    id: text("id").primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    is_ending: boolean('is_ending').notNull().default(false),
})

// items:      id (text pk, e.g. "key"), name, portable (boolean)
export const items = pgTable('items', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    portable: boolean().notNull(),
})
// room_items: room_id (fk -> rooms.id), item_id (fk -> items.id)
export const room_items = pgTable(
    'room_items', 
    {
        room_id: text("room_id").notNull().references(() => rooms.id),
        item_id: text('item_id').notNull().references(() => items.id),
    },
    (table) => [primaryKey({ columns: [table.room_id, table.item_id] })]
)
//             — replaces world.ts's Room.items: string[]
// exits:      id (pk), from_room_id (fk -> rooms.id), direction,
//             to_room_id (fk -> rooms.id), and something to represent
//             the "locked without the key" rule from M1 — think about
//             what column that is and what it should reference.
//
export const exits = pgTable('exits', {
    id: text('id').primaryKey(),
    from_room_id: text('from_room_id').notNull().references(() => rooms.id),
    direction: text('direction').notNull(),
    to_room_id: text('to_room_id').notNull().references(() => rooms.id),
    required_item: text('required_item').references(() => items.id),
    required_flag: text('required_flag'),
    locked_message: text('locked_message'),
})
// Reference for fk/pk syntax: node_modules/drizzle-orm/pg-core (or the
// Drizzle docs) for `.references(() => otherTable.column)`.
export const runs = pgTable('runs', {
    id: uuid("id").defaultRandom().primaryKey(),
    session_id: text('session_id').notNull().unique(),
    current_room_id: text("current_room_id").notNull().references(() => rooms.id),
    inventory: jsonb("inventory").notNull(),
    flags: jsonb("flags").notNull(),
    started_at: timestamp("started_at").notNull().defaultNow(),
    last_action_at: timestamp("last_action_at").notNull().defaultNow(),
    // Model calls this session has used; capped server-side in lib/ai/generationQuota.ts.
    generation_count: integer("generation_count").notNull().default(0),
})

export const worlds = pgTable("worlds", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
})

// Cached AI room prose (M5). One row per model call, so the latest row
// for a room is what the game shows.
export const generations = pgTable("generations", {
    id: uuid("id").defaultRandom().primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    model: text("model").notNull(),
    prose: text("prose").notNull(),
    mood: text("mood").notNull(),
    referenced_items: jsonb("referenced_items").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
})

// One row per room while a prose generation is running. The primary key makes
// "who generates this room?" an atomic decision across server instances.
export const generation_locks = pgTable("generation_locks", {
    room_id: text("room_id").primaryKey().references(() => rooms.id),
    started_at: timestamp("started_at").notNull().defaultNow(),
})

// Using item_id in room_id sets flag (and optionally consumes the item).
export const interactions = pgTable("interactions", {
    id: text("id").primaryKey(),
    room_id: text("room_id").notNull().references(() => rooms.id),
    item_id: text("item_id").notNull().references(() => items.id),
    flag: text("flag").notNull(),
    message: text("message").notNull(),
    consume: boolean("consume").notNull().default(false),
})
