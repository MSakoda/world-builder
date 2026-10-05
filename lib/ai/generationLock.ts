import { eq, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { generation_locks } from "../db/schema";

// A lock older than this is assumed to belong to a crashed request.
const STALE_AFTER_SECONDS = 60;

/**
 * Tries to become the one request generating this room. The insert is atomic,
 * so exactly one concurrent caller wins, even across server instances.
 * Returns false if someone else holds a fresh lock.
 */
export async function acquireGenerationLock(roomId: string): Promise<boolean> {
  const rows = await db
    .insert(generation_locks)
    .values({ room_id: roomId })
    .onConflictDoUpdate({
      target: generation_locks.room_id,
      set: { started_at: sql`now()` },
      // Only take over a stale lock; a fresh one means a generation is running.
      setWhere: lt(generation_locks.started_at, sql`now() - make_interval(secs => ${STALE_AFTER_SECONDS})`),
    })
    .returning({ room_id: generation_locks.room_id });
  return rows.length > 0;
}

export async function releaseGenerationLock(roomId: string): Promise<void> {
  await db.delete(generation_locks).where(eq(generation_locks.room_id, roomId));
}
