import { pgTable, text, boolean, integer, primaryKey, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";

// (Marcus): define rooms, exits, items, room_items.
//
// rooms:      id (text pk, e.g. "entrance"), title, description
export const rooms = pgTable("rooms", {
    id: text("id").primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull()
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
    required_item: text('required_item').references(() => items.id)
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
})
