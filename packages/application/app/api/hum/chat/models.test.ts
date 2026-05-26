import { describe, test, expect } from "vitest";
import { resolveModel, totalInputTokens, HUM_DEFAULT_MODEL } from "./models";

describe("resolveModel", () => {
  test("returns default when given undefined", () => {
    expect(resolveModel(undefined)).toBe(HUM_DEFAULT_MODEL);
  });

  test("returns default when given an unknown string", () => {
    expect(resolveModel("claude-unknown-model")).toBe(HUM_DEFAULT_MODEL);
  });

  test("returns default when given an empty string", () => {
    expect(resolveModel("")).toBe(HUM_DEFAULT_MODEL);
  });

  test("returns claude-sonnet-4-6 when passed exactly", () => {
    expect(resolveModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  test("returns claude-opus-4-7 when passed exactly", () => {
    expect(resolveModel("claude-opus-4-7")).toBe("claude-opus-4-7");
  });
});

describe("totalInputTokens", () => {
  test("sums all three fields", () => {
    expect(totalInputTokens({ input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 25 })).toBe(175);
  });

  test("treats missing fields as 0", () => {
    expect(totalInputTokens({})).toBe(0);
  });

  test("treats null fields as 0", () => {
    expect(totalInputTokens({ input_tokens: 10, cache_read_input_tokens: null, cache_creation_input_tokens: null })).toBe(10);
  });

  test("handles partial fields", () => {
    expect(totalInputTokens({ input_tokens: 42 })).toBe(42);
    expect(totalInputTokens({ cache_read_input_tokens: 7 })).toBe(7);
    expect(totalInputTokens({ cache_creation_input_tokens: 3 })).toBe(3);
  });
});
