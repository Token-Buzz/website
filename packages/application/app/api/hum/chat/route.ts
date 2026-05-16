import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are Hum, TokenBuzz's crypto social intelligence assistant. You help traders understand social sentiment data from X (Twitter) about crypto tokens.

Be concise and direct — traders want signal, not noise. Reference specific patterns: mention spikes, handle clusters, sentiment flips. Keep responses under 200 words unless the question is genuinely complex. Always end with an actionable observation.

When discussing tokens, prefix with $. When discussing handles, prefix with @.`

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json() as {
    message: string
    history?: Array<{ from: string; text: string }>
  }

  const priorMessages: Anthropic.MessageParam[] = (body.history ?? [])
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.from === 'you' ? 'user' : 'assistant',
      content: m.text,
    }))

  const messages: Anthropic.MessageParam[] = [
    ...priorMessages,
    { role: 'user', content: body.message },
  ]

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            )
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: "\n\nSorry, I'm having trouble connecting. Try again in a moment." })}\n\n`,
          ),
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
