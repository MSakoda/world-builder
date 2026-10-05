import { APICallError } from "ai";

export type ProviderFailure =
  | { kind: "busy"; retryAfterSeconds: number } // rate limited or overloaded: try again later
  | { kind: "unavailable" };

const DEFAULT_RETRY_SECONDS = 30;
const MIN_RETRY_SECONDS = 1;
const MAX_RETRY_SECONDS = 120;

const clamp = (n: number) => Math.min(MAX_RETRY_SECONDS, Math.max(MIN_RETRY_SECONDS, Math.ceil(n)));

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return clamp(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : clamp((date - now) / 1000);
}

// Google also reports a delay in the error body, e.g. "retryDelay": "34s".
function retryDelayFromBody(body: string | undefined): number | null {
  const match = body?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? clamp(Number(match[1])) : null;
}

// The SDK wraps failures (RetryError.lastError, cause), so look through them.
function findApiCallError(error: unknown, depth = 0): APICallError | null {
  if (!error || typeof error !== "object" || depth > 4) return null;
  if (APICallError.isInstance(error)) return error;
  const e = error as { cause?: unknown; lastError?: unknown; errors?: unknown[] };
  for (const inner of [e.lastError, e.cause, ...(e.errors ?? [])]) {
    const found = findApiCallError(inner, depth + 1);
    if (found) return found;
  }
  return null;
}

export function classifyProviderError(error: unknown): ProviderFailure {
  const api = findApiCallError(error);
  if (api && (api.statusCode === 429 || api.statusCode === 503)) {
    const fromHeader = parseRetryAfter(
      api.responseHeaders?.["retry-after"] ?? api.responseHeaders?.["Retry-After"],
    );
    return {
      kind: "busy",
      retryAfterSeconds: fromHeader ?? retryDelayFromBody(api.responseBody) ?? DEFAULT_RETRY_SECONDS,
    };
  }
  return { kind: "unavailable" };
}
