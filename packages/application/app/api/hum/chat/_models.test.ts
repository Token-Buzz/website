import { describe, test, expect } from "vitest";
import { resolveModel, totalInputTokens, toConverseMessages, formatContextItems, HUM_DEFAULT_MODEL } from "./_models";

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

  test("returns us.anthropic.claude-sonnet-4-6 when passed exactly", () => {
    expect(resolveModel("us.anthropic.claude-sonnet-4-6")).toBe("us.anthropic.claude-sonnet-4-6");
  });
});

describe("totalInputTokens", () => {
  test("sums all three Converse fields", () => {
    expect(totalInputTokens({ inputTokens: 100, cacheReadInputTokens: 50, cacheWriteInputTokens: 25 })).toBe(175);
  });

  test("treats missing fields as 0", () => {
    expect(totalInputTokens({})).toBe(0);
  });

  test("treats null fields as 0", () => {
    expect(totalInputTokens({ inputTokens: 10, cacheReadInputTokens: null, cacheWriteInputTokens: null })).toBe(10);
  });

  test("handles partial fields", () => {
    expect(totalInputTokens({ inputTokens: 42 })).toBe(42);
    expect(totalInputTokens({ cacheReadInputTokens: 7 })).toBe(7);
    expect(totalInputTokens({ cacheWriteInputTokens: 3 })).toBe(3);
  });
});

describe("formatContextItems", () => {
  test("returns empty string for undefined", () => {
    expect(formatContextItems(undefined)).toBe("");
  });

  test("returns empty string for empty array", () => {
    expect(formatContextItems([])).toBe("");
  });

  test("single item with summary", () => {
    const result = formatContextItems([{ summary: "Token $PEPE (Pepe), 100 mentions" }]);
    expect(result).toBe('Attached context:\n- Token $PEPE (Pepe), 100 mentions\n');
  });

  test("single item with only label (no summary)", () => {
    const result = formatContextItems([{ label: "BTC Mentions" }]);
    expect(result).toBe("Attached context:\n- BTC Mentions\n");
  });

  test("prefers summary over label when both present", () => {
    const result = formatContextItems([{ label: "BTC", summary: "Token $BTC with full details" }]);
    expect(result).toContain("Token $BTC with full details");
    expect(result).not.toContain("- BTC\n");
  });

  test("multiple items produce one bullet per item", () => {
    const result = formatContextItems([
      { summary: "First item" },
      { summary: "Second item" },
      { summary: "Third item" },
    ]);
    const lines = result.split("\n").filter(Boolean);
    expect(lines[0]).toBe("Attached context:");
    expect(lines[1]).toBe("- First item");
    expect(lines[2]).toBe("- Second item");
    expect(lines[3]).toBe("- Third item");
  });

  test("skips items with neither label nor summary", () => {
    const result = formatContextItems([
      { summary: "Valid item" },
      {},
      { label: "Also valid" },
    ]);
    const bullets = result.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(2);
  });
});

describe("toConverseMessages", () => {
  test("empty history → single user message", () => {
    const result = toConverseMessages([], "hello");
    expect(result).toEqual([{ role: "user", content: [{ text: "hello" }] }]);
  });

  test("undefined history → single user message", () => {
    const result = toConverseMessages(undefined, "hello");
    expect(result).toEqual([{ role: "user", content: [{ text: "hello" }] }]);
  });

  test("history starting with assistant greeting → first message is user (greeting dropped)", () => {
    const history = [
      { from: "hum", text: "Morning. Market opened quiet." },
      { from: "you", text: "Tell me about SOL" },
    ];
    const result = toConverseMessages(history, "More detail please");
    expect(result[0].role).toBe("user");
    expect(result[0].content[0].text).toContain("Tell me about SOL");
  });

  test("two consecutive user turns in history → merged into one message with \\n\\n", () => {
    const history = [
      { from: "you", text: "first user message" },
      { from: "you", text: "second user message" },
    ];
    const result = toConverseMessages(history, "new message");
    // The two history user turns merge, then new message appends as another user turn
    // but since the new message is also user, all three merge
    expect(result.length).toBe(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content[0].text).toContain("first user message");
    expect(result[0].content[0].text).toContain("second user message");
    expect(result[0].content[0].text).toContain("\n\n");
  });

  test("normal you/hum/you history + new user text → strictly alternating, last is new user text", () => {
    const history = [
      { from: "you", text: "What is happening with PEPE?" },
      { from: "hum", text: "PEPE is trending due to..." },
      { from: "you", text: "Is it bullish?" },
    ];
    const result = toConverseMessages(history, "Give me more detail");
    // Roles should alternate: user, assistant, user, user → last two user turns merge
    expect(result.length).toBe(3);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("user");
    expect(result[2].content[0].text).toContain("Give me more detail");
  });
});
