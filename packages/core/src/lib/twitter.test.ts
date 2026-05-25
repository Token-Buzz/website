import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { TwitterApiError } from "./twitter";

describe("TwitterApiError", () => {
  test("carries the upstream HTTP status code", () => {
    const err = new TwitterApiError("Twitter API error: 429 Too Many Requests", 429);
    expect(err.status).toBe(429);
    expect(err.name).toBe("TwitterApiError");
    expect(err.message).toBe("Twitter API error: 429 Too Many Requests");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof TwitterApiError).toBe(true);
  });

  test("works for non-429 error codes", () => {
    const err = new TwitterApiError("Twitter API error: 503 Service Unavailable", 503);
    expect(err.status).toBe(503);
  });
});

// ── searchTweets retry logic ──────────────────────────────────────────────────
//
// Each test uses vi.resetModules() so it gets a fresh module instance with its
// own `RETRY_DELAYS_MS` binding. We override the delays to [0, 0] so retries
// are instant — no fake timers needed.

// Helper: build a minimal valid SearchResponse JSON body
function okBody(tweets: unknown[] = []): string {
  return JSON.stringify({ tweets, has_next_page: false, next_cursor: null });
}

function makeResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("searchTweets retry logic", () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    // Provide a fake API key so searchTweets doesn't bail early
    process.env = { ...ORIG_ENV, TWITTER_API_KEY: "test-key" };
    // Reset module registry so each test gets a fresh RETRY_DELAYS_MS binding
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIG_ENV;
    vi.restoreAllMocks();
  });

  test("5xx then 200 → retries and returns results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(makeResponse(200, okBody([{ id: "1", text: "hi" }])));

    vi.stubGlobal("fetch", fetchMock);

    // Dynamic import after resetModules gives a fresh module
    const mod = await import("./twitter");
    // Zero out delays so the test is instant
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0);

    const tweets = await mod.searchTweets("bitcoin", { maxPages: 1 });
    expect(tweets).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("persistent 5xx → throws TwitterApiError with 5xx status after retry budget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(503, "Service Unavailable"));

    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./twitter");
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0);

    let caughtError: unknown;
    try {
      await mod.searchTweets("bitcoin", { maxPages: 1 });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(mod.TwitterApiError);
    expect((caughtError as InstanceType<typeof mod.TwitterApiError>).status).toBe(503);

    // 3 total attempts: 1 initial + 2 retries (RETRY_DELAYS_MS.length === 2)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("4xx (402) → throws immediately with no retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(402, "Payment Required"));

    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./twitter");
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0);

    let caughtError: unknown;
    try {
      await mod.searchTweets("bitcoin", { maxPages: 1 });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(mod.TwitterApiError);
    expect((caughtError as InstanceType<typeof mod.TwitterApiError>).status).toBe(402);

    // Only 1 fetch call — no retry for 4xx
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("network error then 200 → retries and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(makeResponse(200, okBody()));

    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./twitter");
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0);

    const tweets = await mod.searchTweets("bitcoin", { maxPages: 1 });
    expect(tweets).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("persistent network error → rethrows after retry budget", async () => {
    const networkErr = new TypeError("Failed to fetch");
    const fetchMock = vi.fn().mockRejectedValue(networkErr);

    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./twitter");
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0);

    let caughtError: unknown;
    try {
      await mod.searchTweets("bitcoin", { maxPages: 1 });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBe(networkErr);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
