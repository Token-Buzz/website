import { describe, test, expect } from "vitest";
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
