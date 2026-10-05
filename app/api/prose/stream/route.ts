import { desc, eq } from "drizzle-orm";
import { Output, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "../../../../lib/db/client";
import { generations } from "../../../../lib/db/schema";
import { loadWorld } from "../../../../lib/db/loadWorld";
import { getOrCreateRun } from "../../../../lib/db/getOrCreateRun";
import { getOrCreateSessionId } from "../../../../lib/session";
import { PROSE_MODEL, buildPrompt, roomProseSchema } from "../../../../lib/ai/generateRoomProse";
import {
  MAX_GENERATIONS_PER_SESSION,
  releaseGeneration,
  remainingGenerations,
  reserveGeneration,
} from "../../../../lib/ai/generationQuota";

const encoder = new TextEncoder();
const headers = (remaining: number) => ({
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Generations-Remaining": String(remaining),
});

/**
 * Streams the room prose as plain text. Cached prose is sent as a single
 * chunk and costs nothing; a cache miss calls the model, counts against the
 * session's cap, and streams tokens as they arrive. The cap is enforced here,
 * atomically in the database, so the UI can't be used to bypass it.
 */
export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("room") ?? "";
  const world = await loadWorld();
  const room = world.rooms[roomId];
  if (!room) return Response.json({ error: "Unknown room" }, { status: 404 });

  const sessionId = await getOrCreateSessionId();
  await getOrCreateRun(sessionId);

  const [cached] = await db
    .select()
    .from(generations)
    .where(eq(generations.room_id, room.id))
    .orderBy(desc(generations.created_at))
    .limit(1);
  if (cached) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(cached.prose));
        controller.close();
      },
    });
    return new Response(body, { headers: headers(await remainingGenerations(sessionId)) });
  }

  const remaining = await reserveGeneration(sessionId);
  if (remaining === null) {
    return Response.json(
      { error: `Generation limit reached (${MAX_GENERATIONS_PER_SESSION} per session).` },
      { status: 429, headers: { "X-Generations-Remaining": "0" } },
    );
  }

  // A slot is refunded only when the server or model fails. A client that
  // disconnects or hits Stop keeps its slot: the model call was already made,
  // and refunding aborted requests would let someone generate without limit.
  let finished = false;
  const release = async () => {
    if (finished || request.signal.aborted) return;
    finished = true;
    await releaseGeneration(sessionId);
  };

  const result = streamText({
    model: google(PROSE_MODEL),
    prompt: buildPrompt(room),
    output: Output.object({ schema: roomProseSchema }),
    temperature: 0.8,
    maxOutputTokens: 400,
    abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
  });

  // Pull the first chunk before committing to a 200, so a model failure up
  // front can still be reported as a real error status.
  const partials = result.partialOutputStream[Symbol.asyncIterator]();
  let first: IteratorResult<{ prose?: string }>;
  try {
    first = await partials.next();
  } catch (err) {
    console.error("prose stream failed to start:", err);
    await release();
    return Response.json({ error: "The model is unavailable." }, { status: 502 });
  }

  // The SDK ends the stream without throwing when the model call errors, so an
  // empty stream here means it failed before producing anything.
  if (first.done) {
    console.error("prose stream produced no output:", await result.output.then(() => null, (e) => e));
    await release();
    return Response.json({ error: "The model is unavailable." }, { status: 502 });
  }

  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let step: IteratorResult<{ prose?: string }> = first;
        while (!step.done) {
          const prose = step.value.prose ?? "";
          if (prose.length > sent) {
            controller.enqueue(encoder.encode(prose.slice(sent)));
            sent = prose.length;
          }
          step = await partials.next();
        }
        // Throws if the finished object doesn't match the schema.
        const final = await result.output;
        await db.insert(generations).values({
          room_id: room.id,
          model: PROSE_MODEL,
          prose: final.prose,
          mood: final.mood,
          referenced_items: final.referencedItems,
        });
        finished = true;
        controller.close();
      } catch (err) {
        console.error("prose stream failed:", err);
        await release();
        controller.error(err);
      }
    },
  });
  return new Response(body, { headers: headers(remaining) });
}
