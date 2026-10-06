"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STREAM_END } from "../lib/ai/streamProtocol";

export type ProseStatus = "streaming" | "done" | "error" | "busy" | "stopped" | "limit";

type ProseState = {
  roomId: string;
  text: string;
  status: ProseStatus;
  message?: string; // for "error"
  retryAt?: number; // for "busy": epoch ms when retrying makes sense
};

/**
 * Streams AI room prose from /api/prose/stream, exposing the text so far,
 * a Stop (AbortController), a retry, and the server-reported remaining count.
 * The cap itself is enforced by the server; this only displays it.
 *
 * A response only counts as complete if it ends with STREAM_END, so a
 * connection that is cut cleanly mid-text is reported as an error, not shown
 * as a finished (truncated) description.
 */
export function useRoomProse(roomId: string, initialRemaining: number) {
  const [state, setState] = useState<ProseState>({ roomId, text: "", status: "streaming" });
  const [remaining, setRemaining] = useState(initialRemaining);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    // Late results from a request we've abandoned (Stop, left the room) must not land.
    const update = (next: ProseState) => {
      if (!controller.signal.aborted) setState(next);
    };

    (async () => {
      try {
        const res = await fetch(`/api/prose/stream?room=${encodeURIComponent(roomId)}`, {
          signal: controller.signal,
        });
        const header = res.headers.get("X-Generations-Remaining");
        if (header !== null && !controller.signal.aborted) setRemaining(Number(header));

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}) as { code?: string; retryAfter?: number });
          if (res.status === 429 && body.code === "session_limit") {
            return update({ roomId, text: "", status: "limit" });
          }
          if (res.status === 503 && body.code === "provider_busy") {
            const seconds = Number(body.retryAfter ?? res.headers.get("Retry-After")) || 30;
            // Start the countdown from the moment the limit arrived, not from mount.
            if (!controller.signal.aborted) setNow(Date.now());
            return update({ roomId, text: "", status: "busy", retryAt: Date.now() + seconds * 1000 });
          }
          return update({
            roomId,
            text: "",
            status: "error",
            message: "Couldn't generate a description.",
          });
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let raw = "";
        update({ roomId, text: "", status: "streaming" });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          update({ roomId, text: raw.replace(STREAM_END, ""), status: "streaming" });
        }
        if (!raw.endsWith(STREAM_END)) throw new Error("incomplete stream");
        update({ roomId, text: raw.slice(0, -STREAM_END.length), status: "done" });
      } catch {
        // A network drop mid-stream throws; a clean cut ends without the marker.
        // Either way, retrying is cheap: the server keeps generating after a disconnect.
        update({ roomId, text: "", status: "error", message: "Connection lost." });
      }
    })();

    return () => controller.abort();
  }, [roomId, attempt]);

  // Tick once a second while waiting out a provider rate limit.
  const busyUntil = state.status === "busy" ? state.retryAt : undefined;
  useEffect(() => {
    if (!busyUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [busyUntil]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    setState((s) => ({ ...s, status: "stopped" }));
  }, []);

  const retry = useCallback(() => {
    setState({ roomId, text: "", status: "streaming" });
    setAttempt((a) => a + 1);
  }, [roomId]);

  // State from a room we've already left must not leak into the new one.
  const current: ProseState =
    state.roomId === roomId ? state : { roomId, text: "", status: "streaming" };
  const retryInSeconds = current.retryAt ? Math.max(0, Math.ceil((current.retryAt - now) / 1000)) : 0;

  return {
    text: current.text,
    status: current.status,
    message: current.message,
    retryInSeconds,
    remaining,
    stop,
    retry,
  };
}
