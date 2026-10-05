import { describe, expect, it } from "vitest";
import { APICallError } from "ai";
import { classifyProviderError, parseRetryAfter } from "./providerErrors";

const apiError = (statusCode: number, extra: Partial<ConstructorParameters<typeof APICallError>[0]> = {}) =>
  new APICallError({ message: "x", url: "u", requestBodyValues: {}, statusCode, ...extra });

describe("classifyProviderError", () => {
  it("treats 429 as busy and honours Retry-After", () => {
    expect(classifyProviderError(apiError(429, { responseHeaders: { "retry-after": "7" } }))).toEqual({
      kind: "busy",
      retryAfterSeconds: 7,
    });
  });
  it("falls back to Google's retryDelay in the body, then a default", () => {
    const body = '{"error":{"details":[{"retryDelay":"34s"}]}}';
    expect(classifyProviderError(apiError(429, { responseBody: body }))).toMatchObject({ retryAfterSeconds: 34 });
    expect(classifyProviderError(apiError(429))).toMatchObject({ kind: "busy", retryAfterSeconds: 30 });
  });
  it("treats 503 as busy", () => {
    expect(classifyProviderError(apiError(503)).kind).toBe("busy");
  });
  it("sees through wrapped errors", () => {
    const wrapped = Object.assign(new Error("retries exhausted"), { lastError: apiError(429) });
    expect(classifyProviderError(wrapped).kind).toBe("busy");
    expect(classifyProviderError(new Error("boom", { cause: apiError(429) })).kind).toBe("busy");
  });
  it("treats everything else as unavailable", () => {
    expect(classifyProviderError(apiError(400))).toEqual({ kind: "unavailable" });
    expect(classifyProviderError(new Error("boom"))).toEqual({ kind: "unavailable" });
    expect(classifyProviderError(undefined)).toEqual({ kind: "unavailable" });
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds, dates, and clamps", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("99999")).toBe(120);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10);
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
});
