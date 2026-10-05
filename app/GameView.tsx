"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameState, World, Action, ActionResult, Direction } from "../lib/engine/types";
import { applyAction } from "@/lib/engine/applyAction";
import { generateRoomProse } from "@/lib/ai/generateRoomProse";
import { useEffect } from "react";

type ActionResponse = { result: ActionResult; state: GameState };

const GAME_STATE_KEY = ["gameState"];

type GameViewProps = {
  initialState: GameState;
  world: World;
};

export default function GameView({ initialState, world }: GameViewProps) {
  const queryClient = useQueryClient();

  // 1. useQuery(GAME_STATE_KEY, ...) seeded with `initialData: initialState`.
  //    The queryFn will basically never run — we already have the data from
  //    the server — but TanStack Query still requires one. A function that
  //    just returns the current cache value (or throws) is fine here.
  //
  //    const { data: state } = useQuery({
  //      queryKey: GAME_STATE_KEY,
  //      queryFn: () => queryClient.getQueryData<GameState>(GAME_STATE_KEY)!,
  //      initialData: initialState,
  //      staleTime: Infinity, // never auto-refetch; mutations own updates
  //    });
  const { data: state } = useQuery({
    queryKey: GAME_STATE_KEY,
    queryFn: () => queryClient.getQueryData<GameState>(GAME_STATE_KEY)!,
    initialData: initialState,
    staleTime: Infinity,
  }) 

  // 2. Look up the current room from `world`:
  //      const room = world.rooms[state.currentRoom];
  //    Render room.title, room.description, and each item id in
  //    state.inventory via world.items[id].name.
  const room = world.rooms[state.currentRoom];

  useEffect(() => {
    generateRoomProse(room);
  }, [])

  

  // 3. useMutation for POST /api/action:
  //      const mutation = useMutation({
  //        mutationFn: async (action: Action) => {
  //          const res = await fetch("/api/action", {
  //            method: "POST",
  //            headers: { "Content-Type": "application/json" },
  //            body: JSON.stringify(action),
  //          });
  //          return (await res.json()) as ActionResponse;
  //        },
  //        onMutate: async (action) => { /* optimistic update — see below */ },
  //        onError: (err, action, context) => { /* rollback using context */ },
  //        onSuccess: (data) => { /* reconcile cache with server's real state */ },
  //      });
  //
  //    Think through onMutate before writing it: what's the previous cache
  //    value you'd need to save in `context` to roll back to, and should
  //    every action type here even attempt an optimistic guess given the
  //    tension we talked about (locked doors, non-portable items)?
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      return (await res.json()) as ActionResponse;
    },
    onMutate: async (action) => { 
      await queryClient.cancelQueries({ queryKey: GAME_STATE_KEY});
      const previousState = queryClient.getQueryData<GameState>(GAME_STATE_KEY)!;
      const predicted = applyAction(previousState, action, world);
      queryClient.setQueryData(GAME_STATE_KEY, predicted.state);
      return { previousState };
    },
    onError: (err, action, context) => {
      queryClient.setQueryData(GAME_STATE_KEY, context?.previousState);
    },
    onSuccess: (data, action, context) => { 
      if( data.result.success ) {
        queryClient.setQueryData(GAME_STATE_KEY, data.state);
      } else {
        queryClient.setQueryData(GAME_STATE_KEY, context.previousState);
      }
    },
  });
  
  // 4. Render buttons for available actions:
  //    - one per direction in Object.keys(room.exits), calling
  //      mutation.mutate({ verb: "go", direction })
  //    - one per item id in room.items, calling
  //     
  // 
  //  mutation.mutate({ verb: "take", target: itemId })
  const directions = Object.keys(room.exits).map( (exit) => {
    return (
      <button 
        key={exit} 
        onClick={() => mutation.mutate({ verb: 'go', direction: exit as Direction})}
        disabled={mutation.isPending}
        className={`border rounded cursor-pointer px-2 py-1`+
          ` disabled:cursor-not-allowed disabled:opacity-25`
        }
      >
        {exit}
      </button>
    )
  })

  const roomItems = room.items.map( item => {
    // check if you have item already
    const hasItem = state.inventory.includes(item);
    return (
      <button
        key={item}
        disabled={hasItem || mutation.isPending}
        onClick={() => mutation.mutate({ verb: 'take', target: item})}
        className={`border rounded cursor-pointer px-2 py-1 ${hasItem ? 'disabled:cursor-not-allowed disabled:opacity-25' : ''}`}
      >
        {item}
      </button>
    )
  })
  
  return (
    <div className="text-center mt-5">
      <h1 className="text-xl">{room.title}</h1>
      <h2 className="text-l">{room.description}</h2>
      <h3 className="mt-5 text-sm">Exits:</h3>
      <div className="directions mt-2 flex justify-center gap-2">
        {directions}
      </div>
      <h3 className="mt-5 text-sm">Items:</h3>
      <div className="directions mt-2 flex justify-center gap-2">
        {roomItems}
      </div>
      <h3 className="mt-5 text-sm">Inventory ({state.inventory.length}):</h3>
      <ul>
        {state.inventory.map( item => <li key={item}>{world.items[item].name}</li>)}
      </ul>
    </div>
  )
}
