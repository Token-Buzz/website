import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const client = new BedrockRuntimeClient({ region: "us-east-1" });

const SYSTEM_PROMPT =
  'You are a crypto social sentiment classifier. Given a tweet and the associated token symbol, classify the sentiment. Reply ONLY with JSON: {"sentiment":"bull"|"bear"|"neutral","score":<integer -100 to 100>}. Bull means positive/bullish on the token, bear means negative/bearish, neutral means informational or ambiguous.';

export type SentimentResult = {
  sentiment: "bull" | "bear" | "neutral";
  score: number;  // -100 to +100
};

// Classifies tweet sentiment. Returns neutral/0 on any error; logs the
// underlying cause so silent fallbacks are debuggable.
export async function classifySentiment(tweetText: string, tokenSymbol: string): Promise<SentimentResult> {
  try {
    const response = await client.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: `Token: ${tokenSymbol}\nTweet: ${tweetText}` }] }],
      inferenceConfig: { maxTokens: 64 },
    }));

    // Bedrock ConverseCommand response: output.message.content[].text
    const content = response.output?.message?.content ?? [];
    const textBlock = content.find((c): c is { text: string } => "text" in c);
    if (!textBlock) {
      console.warn("[sentiment] empty response content");
      return { sentiment: "neutral", score: 0 };
    }

    // Strip markdown code fences if Claude wrapped the JSON in ``` blocks
    const raw = textBlock.text.trim();
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: { sentiment?: unknown; score?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn(
        "[sentiment] JSON parse failed; raw response:",
        raw.slice(0, 200),
        "err:",
        parseErr,
      );
      return { sentiment: "neutral", score: 0 };
    }

    if (typeof parsed.sentiment === "string" && typeof parsed.score === "number") {
      return { sentiment: parsed.sentiment as "bull" | "bear" | "neutral", score: parsed.score };
    }
    console.warn("[sentiment] unexpected JSON shape:", parsed);
    return { sentiment: "neutral", score: 0 };
  } catch (err) {
    console.error("[sentiment] Bedrock call failed:", err);
    return { sentiment: "neutral", score: 0 };
  }
}
