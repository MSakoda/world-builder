"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameState, World, Action, ActionResult, Direction } from "../lib/engine/types";
import { MAX_GENERATIONS_PER_SESSION } from "../lib/ai/limits";
import { useRoomProse } from "./useRoomProse";
import { applyAction } from "@/lib/engine/applyAction";

type ActionResponse = { result: ActionResult; state: GameState };

const GAME_STATE_KEY = ["gameState"];

type GameViewProps = {
  initialState: GameState;
  world: World;
  initialRemaining: number;
};

type Feedback = { text: string; ok: boolean } | null;

const button =
  "border rounded cursor-pointer px-2 py-1 disabled:cursor-not-allowed disabled:opacity-25";

export default function GameView({ initialState, world, initialRemaining }: GameViewProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const { data: state } = useQuery({
    queryKey: GAME_STATE_KEY,
    queryFn: () => queryClient.getQueryData<GameState>(GAME_STATE_KEY)!,
    initialData: initialState,
    staleTime: Infinity,
  });

  const room = world.rooms[state.currentRoom];

  // AI prose streams in separately so it never blocks an action. The
  // hand-authored description shows until text arrives, or if generation
  // fails, is stopped, or hits the session cap.
  const prose = useRoomProse(state.currentRoom, initialRemaining);
  const showStreamed = prose.status === "streaming" || prose.status === "done";

  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as ActionResponse;
    },
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: GAME_STATE_KEY });
      setFeedback(null);
      const previousState = queryClient.getQueryData<GameState>(GAME_STATE_KEY)!;
      const predicted = applyAction(previousState, action, world);
      queryClient.setQueryData(GAME_STATE_KEY, predicted.state);
      return { previousState };
    },
    onError: (_err, _action, context) => {
      queryClient.setQueryData(GAME_STATE_KEY, context?.previousState);
      setFeedback({ text: "Something went wrong. Please try again.", ok: false });
    },
    onSuccess: (data, _action, context) => {
      queryClient.setQueryData(
        GAME_STATE_KEY,
        data.result.success ? data.state : context.previousState,
      );
      setFeedback({ text: data.result.message, ok: data.result.success });
    },
  });

  const act = (action: Action) => mutation.mutate(action);
  const busy = mutation.isPending;
  const itemName = (id: string) => world.items[id]?.name ?? id;

  const exits = Object.entries(room.exits) as [
    Direction,
    { to: string; requiredItem?: string },
  ][];

  return (
    <div className="text-center mt-5">
      <h1 className="text-xl">{room.title}</h1>
      <p className="text-lg mt-2 mx-auto max-w-prose" aria-busy={prose.status === "streaming"}>
        {showStreamed && prose.text ? prose.text : room.description}
      </p>
      <div className="mt-1 text-xs flex justify-center items-center gap-2">
        {prose.status === "streaming" && (
          <>
            <span className="opacity-50">
              {prose.text ? "Writing…" : "The room comes into focus…"}
            </span>
            <button className={button} onClick={prose.stop}>
              Stop
            </button>
          </>
        )}
        {prose.status === "stopped" && (
          <button className={button} onClick={prose.retry}>
            Generate again
          </button>
        )}
        {prose.status === "error" && (
          <>
            <span className="text-red-600">{prose.message}</span>
            <button className={button} onClick={prose.retry}>
              Retry
            </button>
          </>
        )}
        {prose.status === "busy" && (
          <>
            <span className="opacity-70">
              The description service is busy
              {prose.retryInSeconds > 0 ? ` — try again in ${prose.retryInSeconds}s.` : "."}
            </span>
            <button className={button} disabled={prose.retryInSeconds > 0} onClick={prose.retry}>
              Retry
            </button>
          </>
        )}
        {prose.status === "limit" && (
          <span className="opacity-70">Generation limit reached for this session.</span>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`mt-4 min-h-6 text-sm ${feedback && !feedback.ok ? "text-red-600" : ""}`}
      >
        {feedback?.text}
      </p>

      <div className="mt-2">
        <button className={button} disabled={busy} onClick={() => act({ verb: "look" })}>
          Look around
        </button>
      </div>

      <h3 className="mt-5 text-sm">Exits:</h3>
      <div className="mt-2 flex justify-center gap-2">
        {exits.map(([direction, exit]) => {
          const locked = !!exit.requiredItem && !state.inventory.includes(exit.requiredItem);
          return (
            <button
              key={direction}
              className={button}
              disabled={busy}
              title={locked ? `Requires ${itemName(exit.requiredItem!)}` : undefined}
              onClick={() => act({ verb: "go", direction })}
            >
              {direction}
              {locked && " (locked)"}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm">Items:</h3>
      <div className="mt-2 flex justify-center gap-2">
        {room.items.length === 0 && <span className="text-sm opacity-50">Nothing here.</span>}
        {room.items.map((id) => {
          const hasItem = state.inventory.includes(id);
          return (
            <button
              key={id}
              className={button}
              disabled={hasItem || busy}
              onClick={() => act({ verb: "take", target: id })}
            >
              {itemName(id)}
              {hasItem && " (taken)"}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm">Inventory ({state.inventory.length}):</h3>
      <div className="mt-2 flex justify-center gap-2">
        {state.inventory.length === 0 && <span className="text-sm opacity-50">Empty.</span>}
        {state.inventory.map((id) => (
          <button
            key={id}
            className={button}
            disabled={busy}
            onClick={() => act({ verb: "use", target: id })}
          >
            Use {itemName(id)}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs opacity-50" data-testid="generations-left">
        AI generations left: {prose.remaining} / {MAX_GENERATIONS_PER_SESSION}
      </p>
      <p className="mt-2 text-xs opacity-50">
        <Link href="/worlds" className="underline">
          Saved worlds
        </Link>
      </p>
    </div>
  );
}
