import { and, eq, lt, gt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { runs } from "../db/schema";

import { MAX_GENERATIONS_PER_SESSION } from "./limits";

export { MAX_GENERATIONS_PER_SESSION };

/**
 * Atomically claims one generation for the session. A single conditional
 * UPDATE does the check and the increment together, so concurrent requests
 * can't slip past the cap. Returns the number still available afterwards,
 * or null if the session is at its cap (or has no run).
 */
export async function reserveGeneration(sessionId: string): Promise<number | null> {
  const [row] = await db
    .update(runs)
    .set({ generation_count: sql`${runs.generation_count} + 1` })
    .where(
      and(eq(runs.session_id, sessionId), lt(runs.generation_count, MAX_GENERATIONS_PER_SESSION)),
    )
    .returning({ used: runs.generation_count });
  return row ? MAX_GENERATIONS_PER_SESSION - row.used : null;
}

/** Gives a reservation back when the model call failed, so errors don't burn the cap. */
export async function releaseGeneration(sessionId: string): Promise<void> {
  await db
    .update(runs)
    .set({ generation_count: sql`${runs.generation_count} - 1` })
    .where(and(eq(runs.session_id, sessionId), gt(runs.generation_count, 0)));
}

export async function remainingGenerations(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ used: runs.generation_count })
    .from(runs)
    .where(eq(runs.session_id, sessionId));
  return MAX_GENERATIONS_PER_SESSION - (row?.used ?? 0);
}
