// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRoomProse } from "./useRoomProse";
import { STREAM_END } from "../lib/ai/streamProtocol";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- a fake /api/prose/stream ------------------------------------------

type FakeStream = {
  push: (text: string) => void;
  end: () => void; // close cleanly
  fail: (err?: Error) => void; // connection error mid-stream
  signal: AbortSignal;
};

const enc = new TextEncoder();
let requests: { url: string; stream?: FakeStream }[] = [];
let handler: (url: string, signal: AbortSignal) => Promise<Response> | Response;

/** A response whose body we feed by hand, to control exactly what the hook sees. */
function liveResponse(signal: AbortSignal, headers: Record<string, string> = {}) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  signal.addEventListener("abort", () => {
    try {
      controller.error(new DOMException("aborted", "AbortError"));
    } catch {}
  });
  const stream: FakeStream = {
    push: (t) => controller.enqueue(enc.encode(t)),
    end: () => controller.close(),
    fail: (err = new TypeError("network error")) => controller.error(err),
    signal,
  };
  return { stream, response: new Response(body, { headers }) };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

beforeEach(() => {
  requests = [];
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    requests.push({ url: input });
    const signal = init!.signal!;
    if (signal.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
    return Promise.resolve(handler(input, signal));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Route handler that streams a response we control. */
function useLiveStream(headers: Record<string, string> = { "X-Generations-Remaining": "9" }) {
  handler = (url, signal) => {
    const { stream, response } = liveResponse(signal, headers);
    requests.find((r) => r.url === url && !r.stream)!.stream = stream;
    return response;
  };
}
const latest = () => requests[requests.length - 1].stream!;

describe("useRoomProse", () => {
  it("renders text as it streams in, strips the end marker, and reads the remaining count", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    expect(result.current).toMatchObject({ status: "streaming", text: "", remaining: 10 });

    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    await act(async () => latest().push("A chilling "));
    await waitFor(() => expect(result.current.text).toBe("A chilling "));
    expect(result.current.status).toBe("streaming");
    expect(result.current.remaining).toBe(9);

    await act(async () => {
      latest().push("draft." + STREAM_END);
      latest().end();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.text).toBe("A chilling draft.");
    expect(requests[0].url).toBe("/api/prose/stream?room=entrance");
  });

  it("never shows the end marker even when it arrives alone in a late chunk", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    await act(async () => latest().push("Whole text."));
    await act(async () => {
      latest().push(STREAM_END);
      latest().end();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.text).toBe("Whole text.");
  });

  it("treats a stream that ends without the marker as an error, then retry recovers", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    await act(async () => {
      latest().push("A chilling dra"); // cut cleanly: no marker
      latest().end();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ message: "Connection lost.", text: "" });

    act(() => result.current.retry());
    expect(result.current.status).toBe("streaming");
    await waitFor(() => expect(requests[1]?.stream).toBeDefined());
    await act(async () => {
      latest().push("Full text." + STREAM_END);
      latest().end();
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.text).toBe("Full text.");
  });

  it("reports a network error mid-stream", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    await act(async () => latest().push("Half a sent"));
    await act(async () => latest().fail());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.message).toBe("Connection lost.");
  });

  it("reports a failed request (fetch rejects)", async () => {
    handler = () => Promise.reject(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.message).toBe("Connection lost.");
  });

  it("Stop aborts the request and ignores anything that arrives afterwards", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    const stream = latest();
    await act(async () => stream.push("Partial"));
    await waitFor(() => expect(result.current.text).toBe("Partial"));

    act(() => result.current.stop());
    expect(stream.signal.aborted).toBe(true);
    expect(result.current.status).toBe("stopped");

    // A straggler from the abandoned request must not change anything.
    await act(async () => {
      try {
        stream.push("more");
      } catch {}
    });
    expect(result.current.status).toBe("stopped");
  });

  it("starts a fresh request when you retry after Stop", async () => {
    useLiveStream();
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    act(() => result.current.stop());
    act(() => result.current.retry());
    await waitFor(() => expect(requests[1]?.stream).toBeDefined());
    expect(requests[0].stream!.signal.aborted).toBe(true);
    expect(requests[1].stream!.signal.aborted).toBe(false);
    expect(result.current.status).toBe("streaming");
  });

  it("aborts the old request when the room changes, and never leaks its text", async () => {
    useLiveStream();
    const { result, rerender } = renderHook(({ room }) => useRoomProse(room, 10), {
      initialProps: { room: "entrance" },
    });
    await waitFor(() => expect(requests[0]?.stream).toBeDefined());
    const first = latest();
    await act(async () => first.push("Entrance text"));
    await waitFor(() => expect(result.current.text).toBe("Entrance text"));

    rerender({ room: "cellar" });
    expect(first.signal.aborted).toBe(true);
    expect(result.current).toMatchObject({ status: "streaming", text: "" });
    await waitFor(() => expect(requests[1]?.url).toBe("/api/prose/stream?room=cellar"));
  });

  it("shows the cap message and a zero count on 429 session_limit", async () => {
    handler = () => json(429, { code: "session_limit" }, { "X-Generations-Remaining": "0" });
    const { result } = renderHook(() => useRoomProse("entrance", 3));
    await waitFor(() => expect(result.current.status).toBe("limit"));
    expect(result.current.remaining).toBe(0);
  });

  it("counts down a provider rate limit using Retry-After", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    handler = () => json(503, { code: "provider_busy", retryAfter: 5 }, { "Retry-After": "5" });
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("busy");
    expect(result.current.retryInSeconds).toBe(5);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.retryInSeconds).toBe(2);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.retryInSeconds).toBe(0);
    expect(result.current.status).toBe("busy");
  });

  it("falls back to a generic error for other failures", async () => {
    handler = () => json(502, { code: "model_error" });
    const { result } = renderHook(() => useRoomProse("entrance", 10));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.message).toBe("Couldn't generate a description.");
  });
});
