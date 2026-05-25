import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { TwitterApiError, searchTweets, lookupUser, validateKey } from "./twitter";
import type { RawTweet, TwitterAuthor } from "./twitter";

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

// ── Shared test fixtures ──────────────────────────────────────────────────────

const mockAuthor: TwitterAuthor = {
  userName: "testuser",
  id: "123",
  name: "Test User",
  isBlueVerified: false,
  followers: 100,
  following: 50,
  statusesCount: 200,
};

const mockTweet: RawTweet = {
  id: "tweet-1",
  text: "hello world",
  createdAt: "2024-01-01T00:00:00Z",
  likeCount: 5,
  retweetCount: 2,
  replyCount: 1,
  quoteCount: 0,
  viewCount: 100,
  bookmarkCount: 0,
  lang: "en",
  isReply: false,
  author: mockAuthor,
};

// ── searchTweets ──────────────────────────────────────────────────────────────

describe("searchTweets", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends the provided apiKey in the X-API-Key header", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ tweets: [mockTweet], has_next_page: false, next_cursor: null }),
    } as Response);

    await searchTweets("test-api-key-1234", "$SOL", {});

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ "X-API-Key": "test-api-key-1234" });
  });

  test("returns tweets from a single-page response", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ tweets: [mockTweet], has_next_page: false, next_cursor: null }),
    } as Response);

    const result = await searchTweets("api-key-abcd", "$SOL", {});

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tweet-1");
  });

  test("throws TwitterApiError on non-ok response", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({}),
    } as Response);

    await expect(searchTweets("any-key", "$SOL", {})).rejects.toBeInstanceOf(TwitterApiError);
  });
});

// ── lookupUser ────────────────────────────────────────────────────────────────

describe("lookupUser", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns the user object on a 200 response", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockAuthor,
    } as Response);

    const result = await lookupUser("api-key-5678", "testuser");

    expect(result).toEqual(mockAuthor);
  });

  test("returns null on a non-ok response", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
    } as Response);

    const result = await lookupUser("api-key-5678", "nonexistent");

    expect(result).toBeNull();
  });
});

// ── validateKey ───────────────────────────────────────────────────────────────

describe("validateKey", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns ok=true and correct last4 when probe fetch returns 200", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockAuthor,
    } as Response);

    const result = await validateKey("my-secret-key-abcd");

    expect(result.ok).toBe(true);
    expect(result.last4).toBe("abcd");
  });

  test("returns ok=false and correct last4 when probe fetch returns non-ok", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    } as Response);

    const result = await validateKey("bad-key-wxyz");

    expect(result.ok).toBe(false);
    expect(result.last4).toBe("wxyz");
  });

  test("last4 equals the last 4 characters of the input key", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockAuthor,
    } as Response);

    const key = "ABCDEFGH1234";
    const result = await validateKey(key);

    expect(result.last4).toBe("1234");
    expect(result.last4).toBe(key.slice(-4));
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
  beforeEach(() => {
    // Reset module registry so each test gets a fresh RETRY_DELAYS_MS binding
    vi.resetModules();
  });

  afterEach(() => {
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

    const tweets = await mod.searchTweets("test-key", "bitcoin", { maxPages: 1 });
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
      await mod.searchTweets("test-key", "bitcoin", { maxPages: 1 });
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
      await mod.searchTweets("test-key", "bitcoin", { maxPages: 1 });
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

    const tweets = await mod.searchTweets("test-key", "bitcoin", { maxPages: 1 });
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
      await mod.searchTweets("test-key", "bitcoin", { maxPages: 1 });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBe(networkErr);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
