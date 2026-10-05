import { after } from "next/server";
import { desc, eq } from "drizzle-orm";
import { Output, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "../../../../lib/db/client";
import { generations } from "../../../../lib/db/schema";
import { loadWorld } from "../../../../lib/db/loadWorld";
import { getOrCreateRun } from "../../../../lib/db/getOrCreateRun";
import { getOrCreateSessionId } from "../../../../lib/session";
import { PROSE_MODEL, buildPrompt, roomProseSchema } from "../../../../lib/ai/generateRoomProse";
import { classifyProviderError } from "../../../../lib/ai/providerErrors";
import { STREAM_END } from "../../../../lib/ai/streamProtocol";
import { acquireGenerationLock, releaseGenerationLock } from "../../../../lib/ai/generationLock";
import {
  MAX_GENERATIONS_PER_SESSION,
  releaseGeneration,
  remainingGenerations,
  reserveGeneration,
} from "../../../../lib/ai/generationQuota";

export const maxDuration = 60;

const GENERATION_TIMEOUT_MS = 30_000;

// Overridable so tests can point the route at a fake provider.
const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_API_BASE_URL || undefined });

const encoder = new TextEncoder();
const streamHeaders = (remaining: number) => ({
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Generations-Remaining": String(remaining),
});

// When the provider says it's rate limiting us, stop sending it traffic until
// the delay passes. Per server instance, which is enough to avoid hammering it.
let providerBusyUntil = 0;

function busyResponse(retryAfterSeconds: number, remaining: number) {
  return Response.json(
    { code: "provider_busy", error: "The description service is busy.", retryAfter: retryAfterSeconds },
    {
      status: 503,
      headers: { "Retry-After": String(retryAfterSeconds), "X-Generations-Remaining": String(remaining) },
    },
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function latestProse(roomId: string) {
  const [row] = await db
    .select()
    .from(generations)
    .where(eq(generations.room_id, roomId))
    .orderBy(desc(generations.created_at))
    .limit(1);
  return row;
}

/**
 * Streams the room prose as plain text, ending with STREAM_END so the client
 * can tell a complete response from a cut connection.
 *
 * - Cached prose is sent at once and costs nothing.
 * - A cache miss claims one of the session's generations (enforced atomically
 *   in the database, not in the UI), then streams the model's output.
 * - The model call is NOT tied to the client connection: if the player
 *   navigates away or drops mid-stream, generation still finishes and is
 *   cached, so the slot they paid for isn't wasted and a retry is free.
 * - The slot is refunded only if generation fails (provider error, timeout).
 */
export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("room") ?? "";
  const world = await loadWorld();
  const room = world.rooms[roomId];
  if (!room) return Response.json({ error: "Unknown room" }, { status: 404 });

  const sessionId = await getOrCreateSessionId();
  await getOrCreateRun(sessionId);

  // Exactly one request generates a given room; the rest wait for its result.
  // The lock lives in the database, so this holds across server instances.
  let hasLock = false;
  const deadline = Date.now() + GENERATION_TIMEOUT_MS + 5_000;
  for (;;) {
    const cached = await latestProse(room.id);
    if (cached) {
      if (hasLock) await releaseGenerationLock(room.id);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(cached.prose + STREAM_END));
          controller.close();
        },
      });
      return new Response(body, { headers: streamHeaders(await remainingGenerations(sessionId)) });
    }
    if (hasLock || (hasLock = await acquireGenerationLock(room.id))) break;
    if (Date.now() > deadline) {
      return Response.json({ code: "model_error", error: "Timed out waiting." }, { status: 502 });
    }
    await sleep(400);
  }
  // From here this request owns the generation; the lock must always be released.
  const unlock = () => releaseGenerationLock(room.id).catch(() => {});

  if (Date.now() < providerBusyUntil) {
    await unlock();
    return busyResponse(
      Math.ceil((providerBusyUntil - Date.now()) / 1000),
      await remainingGenerations(sessionId),
    );
  }

  const remaining = await reserveGeneration(sessionId);
  if (remaining === null) {
    await unlock();
    return Response.json(
      {
        code: "session_limit",
        error: `Generation limit reached (${MAX_GENERATIONS_PER_SESSION} per session).`,
      },
      { status: 429, headers: { "X-Generations-Remaining": "0" } },
    );
  }

  let settled = false; // true once the prose is saved or the slot is refunded
  const release = async () => {
    if (settled) return;
    settled = true;
    await releaseGeneration(sessionId);
  };
  // Refund, remember a provider rate limit, and return the right error.
  const fail = async (error: unknown) => {
    const failure = classifyProviderError(error);
    if (failure.kind === "busy") providerBusyUntil = Date.now() + failure.retryAfterSeconds * 1000;
    await release();
    await unlock();
    return failure;
  };

  let providerError: unknown;
  const result = streamText({
    model: google(PROSE_MODEL),
    prompt: buildPrompt(room),
    output: Output.object({ schema: roomProseSchema }),
    temperature: 0.8,
    maxOutputTokens: 400,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    // streamText reports failures here instead of throwing.
    onError: ({ error }) => {
      providerError = error;
    },
  });

  // Wait for the first chunk before committing to a 200, so a failure up
  // front can still be reported with a real status code.
  const partials = result.partialOutputStream[Symbol.asyncIterator]();
  let first: IteratorResult<{ prose?: string }>;
  try {
    first = await partials.next();
  } catch (err) {
    console.error("prose stream failed to start:", err);
    providerError = providerError ?? err;
    first = { done: true, value: undefined };
  }
  if (first.done) {
    console.error("prose stream produced no output:", providerError);
    const failure = await fail(providerError);
    const left = await remainingGenerations(sessionId);
    return failure.kind === "busy"
      ? busyResponse(failure.retryAfterSeconds, left)
      : Response.json(
          { code: "model_error", error: "The model is unavailable." },
          { status: 502, headers: { "X-Generations-Remaining": String(left) } },
        );
  }

  // The stream must exist before the producer starts, or its first chunk
  // would be written to nothing.
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      controllerRef = null; // client went away; keep generating, stop writing
    },
  });
  const push = (text: string) => {
    try {
      controllerRef?.enqueue(encoder.encode(text));
    } catch {
      controllerRef = null;
    }
  };
  const finish = (error?: unknown) => {
    try {
      if (error === undefined) controllerRef?.close();
      else controllerRef?.error(error);
    } catch {}
  };

  // Produces the prose and saves it, independent of whether anyone is listening.
  const run = (async () => {
    try {
      let sent = 0;
      let step: IteratorResult<{ prose?: string }> = first;
      while (!step.done) {
        const prose = step.value.prose ?? "";
        if (prose.length > sent) {
          push(prose.slice(sent));
          sent = prose.length;
        }
        step = await partials.next();
      }
      // Throws if the model failed mid-stream or the object doesn't match the schema.
      const final = await result.output;
      await db.insert(generations).values({
        room_id: room.id,
        model: PROSE_MODEL,
        prose: final.prose,
        mood: final.mood,
        referenced_items: final.referencedItems,
      });
      settled = true;
      await unlock();
      push(STREAM_END);
    } catch (err) {
      console.error("prose stream failed:", err);
      await fail(providerError ?? err);
      throw err;
    }
  })();
  // Keep the function alive until generation finishes, even if the client left.
  after(() => run.catch(() => {}));

  run.then(() => finish(), (err) => finish(err ?? new Error("generation failed")));
  return new Response(body, { headers: streamHeaders(remaining) });
}
