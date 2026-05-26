import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveModel, totalInputTokens } from "./models";

const client = new Anthropic();

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

  const priorMessages: Anthropic.Messages.MessageParam[] = (body.history ?? [])
    .filter(m => m.text?.trim())
    .map(m => ({
      role: m.from === "you" ? "user" : "assistant",
      content: m.text,
    }));

  const messages: Anthropic.Messages.MessageParam[] = [
    ...priorMessages,
    { role: "user", content: body.message },
  ];

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // The system prompt is below the model's min cacheable token count today,
        // so it won't cache yet — but Phase 3 context items grow the prefix past
        // the threshold, at which point this cache_control kicks in automatically.
        const stream = client.messages.stream({
          model,
          max_tokens: 1024,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
        });
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        const final = await stream.finalMessage();
        const meta = {
          model,
          tokensIn: totalInputTokens(final.usage),
          tokensOut: final.usage.output_tokens,
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
