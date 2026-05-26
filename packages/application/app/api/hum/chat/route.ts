import { auth } from "@clerk/nextjs/server";
import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { resolveModel, totalInputTokens, toConverseMessages } from "./models";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const SYSTEM_PROMPT = `You are Hum, TokenBuzz's crypto social intelligence assistant. You analyze on-chain data, social sentiment, and market narratives to help traders understand what's happening in the crypto market. You're concise, data-driven, and always cite your reasoning. You focus on social signals — who's talking, what they're saying, and what it means for token momentum. Never give financial advice. Always remind users to verify before trading.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json() as {
    message: string;
    history?: Array<{ from: string; text: string }>;
    model?: string;
  };

  const model = resolveModel(body.model);
  const messages = toConverseMessages(body.history, body.message);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.send(new ConverseStreamCommand({
          modelId: model,
          // cachePoint is Bedrock-native prompt caching. The system prompt is below the
          // model's min cacheable size today so it's a no-op, but Phase 3 context items
          // grow the prefix past the threshold, at which point it caches automatically.
          system: [{ text: SYSTEM_PROMPT }, { cachePoint: { type: "default" } }],
          messages,
          inferenceConfig: { maxTokens: 1024 },
        }));
        let usage: { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheWriteInputTokens?: number } | undefined;
        for await (const item of response.stream ?? []) {
          const text = item.contentBlockDelta?.delta?.text;
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } else if (item.metadata?.usage) {
            usage = item.metadata.usage;
          }
        }
        const meta = {
          model,
          tokensIn: usage ? totalInputTokens(usage) : 0,
          tokensOut: usage?.outputTokens ?? 0,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta })}\n\n`));
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: "\n\nSorry, I'm having trouble connecting. Try again in a moment." })}\n\n`
          )
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
