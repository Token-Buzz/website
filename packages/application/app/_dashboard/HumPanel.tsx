'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon, Eyebrow } from './primitives'
import type { HumMessage } from './types'

const INITIAL_MSG: HumMessage = {
  from: 'hum',
  text: "Morning. Market opened quiet, three of your tokens drifted overnight. Want a brief?",
  time: new Date().toISOString().slice(11, 16) + ' UTC',
}

const SUGGESTIONS = [
  "What's driving $PEPE buzz tonight?",
  "Is the $SOL chatter actually bearish?",
  "Surface new narratives my watchlist missed",
]

// ── Bubble ─────────────────────────────────────────────────────────────────

function HumBubble({ msg }: { msg: HumMessage }) {
  const isHum = msg.from === 'hum'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: isHum ? 'flex-start' : 'flex-end' }}>
      {isHum && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ background: 'var(--inv-bg)', color: 'var(--inv-fg)', fontFamily: 'var(--font-display)', fontSize: 11, padding: '3px 7px 2px', lineHeight: 1 }}>HUM.</div>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{msg.time}</span>
        </div>
      )}
      <div style={{
        maxWidth: '92%', padding: '10px 14px', borderRadius: 12,
        background: isHum ? 'var(--surface)' : 'var(--inv-bg)',
        color: isHum ? 'var(--fg-1)' : 'var(--inv-fg)',
        border: isHum ? '1px solid var(--border)' : 'none',
        font: '400 13px/1.55 var(--font-sans)', letterSpacing: '-0.005em',
      }}>{msg.text}</div>
      {msg.sources && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
          {msg.sources.map((s) => (
            <span key={s} style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 999 }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Thinking indicator ─────────────────────────────────────────────────────

function Thinking() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: 'var(--inv-bg)', color: 'var(--inv-fg)', fontFamily: 'var(--font-display)', fontSize: 11, padding: '3px 7px 2px', lineHeight: 1 }}>HUM.</div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-3)',
              animation: `tb-dot 1.2s ${i * 0.15}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── HumPanel ───────────────────────────────────────────────────────────────

interface HumPanelProps {
  onClose: () => void
  presetQuestion?: string
}

export function HumPanel({ onClose, presetQuestion }: HumPanelProps) {
  const [msgs, setMsgs] = useState<HumMessage[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevPreset = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (presetQuestion && presetQuestion !== prevPreset.current) {
      prevPreset.current = presetQuestion
      send(presetQuestion)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetQuestion])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [msgs, thinking])

  async function send(text: string) {
    if (!text.trim()) return
    const userMsg: HumMessage = { from: 'you', text }
    setMsgs((m) => [...m, userMsg])
    setInput('')
    setThinking(true)

    try {
      const res = await fetch('/api/hum/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: msgs }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      const humMsg: HumMessage = {
        from: 'hum',
        text: '',
        time: new Date().toISOString().slice(11, 16) + ' UTC',
      }
      setThinking(false)
      setMsgs((m) => [...m, humMsg])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulated += parsed.text
                  setMsgs((m) => {
                    const updated = [...m]
                    updated[updated.length - 1] = { ...humMsg, text: accumulated }
                    return updated
                  })
                }
                if (parsed.sources) {
                  setMsgs((m) => {
                    const updated = [...m]
                    updated[updated.length - 1] = { ...humMsg, text: accumulated, sources: parsed.sources }
                    return updated
                  })
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }
        }
      }
    } catch {
      setThinking(false)
      setMsgs((m) => [...m, {
        from: 'hum',
        text: "Sorry, I’m having trouble connecting right now. Try again in a moment.",
        time: new Date().toISOString().slice(11, 16) + ' UTC',
      }])
    }
  }

  return (
    <aside style={{ width: 380, height: '100%', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ background: 'var(--inv-bg)', color: 'var(--inv-fg)', fontFamily: 'var(--font-display)', fontSize: 14, padding: '4px 8px 2px', lineHeight: 1 }}>HUM.</div>
        <div style={{ flex: 1, lineHeight: 1.2 }}>
          <div style={{ font: '600 13px var(--font-sans)' }}>Research assistant</div>
          <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>reads X · reads chain · doesn&apos;t sleep</div>
        </div>
        <Icon name="close" size={16} style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={onClose} />
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {msgs.map((m, i) => <HumBubble key={i} msg={m} />)}
        {thinking && <Thinking />}
      </div>

      {/* Suggestions */}
      {msgs.length <= 2 && !thinking && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Try</Eyebrow>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '8px 12px', borderRadius: 999, cursor: 'pointer', font: '500 12px var(--font-sans)', color: 'var(--fg-2)', textAlign: 'left' }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: 14, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask about a ticker, a handle, a narrative..."
            rows={1}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--fg-1)', maxHeight: 100 }}
          />
          <button
            onClick={() => send(input)}
            style={{ background: input.trim() ? 'var(--buzz-500)' : 'var(--ink-300)', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Icon name="send" size={14} />
          </button>
        </div>
        <div style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)', marginTop: 8, textAlign: 'center' }}>
          Hum cites every source. Always verify before you trade.
        </div>
      </div>
    </aside>
  )
}
