"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProseStatus = "streaming" | "done" | "error" | "stopped" | "limit";

type ProseState = { roomId: string; text: string; status: ProseStatus };

/**
 * Streams AI room prose from /api/prose/stream, exposing the text so far,
 * a Stop (AbortController), a retry, and the server-reported remaining count.
 * The cap itself is enforced by the server; this only displays it.
 */
export function useRoomProse(roomId: string, initialRemaining: number) {
  const [state, setState] = useState<ProseState>({ roomId, text: "", status: "streaming" });
  const [remaining, setRemaining] = useState(initialRemaining);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const res = await fetch(`/api/prose/stream?room=${encodeURIComponent(roomId)}`, {
          signal: controller.signal,
        });
        const header = res.headers.get("X-Generations-Remaining");
        if (header !== null) setRemaining(Number(header));

        if (res.status === 429) {
          setState({ roomId, text: "", status: "limit" });
          return;
        }
        if (!res.ok || !res.body) throw new Error(`Prose request failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        setState({ roomId, text, status: "streaming" });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setState({ roomId, text, status: "streaming" });
        }
        setState({ roomId, text, status: "done" });
      } catch {
        // Aborts come from Stop or from leaving the room; neither is an error.
        if (!controller.signal.aborted) setState({ roomId, text: "", status: "error" });
      }
    })();

    return () => controller.abort();
  }, [roomId, attempt]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    setState((s) => ({ ...s, status: "stopped" }));
  }, []);

  const retry = useCallback(() => {
    setState({ roomId, text: "", status: "streaming" });
    setAttempt((a) => a + 1);
  }, [roomId]);

  // State from a room we've already left must not leak into the new one.
  const current = state.roomId === roomId ? state : { roomId, text: "", status: "streaming" as const };
  return { text: current.text, status: current.status, remaining, stop, retry };
}
