import { eq } from "drizzle-orm";
import { db } from "./client";
import { runs } from "./schema";

export const STARTING_ROOM_ID = "entrance";

export type Run = typeof runs.$inferSelect;

/**
 * Atomic find-or-create: relies on the unique constraint on
 * runs.session_id plus onConflictDoNothing() so two near-simultaneous
 * first-time requests for the same session can't create two runs.
 */
export async function getOrCreateRun(sessionId: string): Promise<Run> {
  // (Marcus):
  // 1. Try to insert a fresh run for this sessionId:
  //    - current_room_id: STARTING_ROOM_ID
  //    - inventory: [] (jsonb)
  //    - flags: {} (jsonb)
  //    Chain .onConflictDoNothing() and .returning() on the insert.
  //    (New import above: `eq` from drizzle-orm, for step 2's WHERE clause.)
  //
  let run = await db.insert(runs).values([
      {
        session_id: sessionId,
        current_room_id: STARTING_ROOM_ID,
        inventory: [],
        flags: {},
      }
    ]).onConflictDoNothing().returning()
  // 2. If that insert returned a row, that's your run — return it.
  //
  if( run.length > 0 ) return run[0];
  // 3. If it returned nothing (conflict — this session already has a
  //    run, whether from an earlier visit or a request that won a
  //    race against this one), fall back to:
  //      db.select().from(runs).where(eq(runs.session_id, sessionId))
  //    and return the row it finds.
  run = await db.select().from(runs).where(eq(runs.session_id, sessionId));
  return run[0];

}
