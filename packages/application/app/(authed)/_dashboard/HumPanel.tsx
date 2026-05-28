'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon, Eyebrow } from './primitives'
import { useUpgradeModal } from '@/app/_billing/UpgradeModalProvider'
import type { Plan } from '@monorepo-template/core/billing/tiers'
import type { HumMessage } from './types'
import type { HumStagedContext } from './humContext'
import { HUM_CONTEXT_MIME, parseContext, fromCardEvent } from './humContext'
import { formatRelativeTime } from './humTime'

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
      {!isHum && msg.contextItems && msg.contextItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingRight: 4 }}>
          {msg.contextItems.map((c, i) => (
            <span key={i} style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 999 }}>{c.label}</span>
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

interface ConversationSummary {
  conversationId: string
  title: string
  updatedAt: string
  messageCount: number
  preview?: string
}

interface HumPanelProps {
  onClose: () => void
  open: boolean
  presetQuestion?: string
  onPresetConsumed?: () => void
}

export function HumPanel({ onClose, open, presetQuestion, onPresetConsumed }: HumPanelProps) {
  const [msgs, setMsgs] = useState<HumMessage[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [stagedContext, setStagedContext] = useState<HumStagedContext[]>([])
  const [dragHover, setDragHover] = useState(false)
  const [activeTab, setActiveTab] = useState<'current' | 'previous'>('current')
  const [prevConversations, setPrevConversations] = useState<ConversationSummary[]>([])
  const [quota, setQuota] = useState<{ allowed: boolean; used: number; limit: number | null; plan: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const loadedRef = useRef(false)

  const { openUpgrade } = useUpgradeModal()

  const refreshQuota = useCallback(() => {
    fetch('/api/hum/quota')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setQuota(data) })
      .catch(() => { /* best-effort */ })
  }, [])

  // ── Restore conversation on first open ──────────────────────────────────
  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true

    async function restore() {
      try {
        const listRes = await fetch('/api/hum/conversations')
        if (!listRes.ok) return
        const listData = await listRes.json() as {
          conversations: Array<{ conversationId: string; title: string; updatedAt: string; messageCount: number }>
        }
        const conversations = listData.conversations
        if (!conversations || conversations.length === 0) return

        // Take the most recent conversation (API returns newest-first)
        const mostRecent = conversations[0]
        const detailRes = await fetch(`/api/hum/conversations/${mostRecent.conversationId}`)
        if (!detailRes.ok) return
        const detailData = await detailRes.json() as {
          conversation: { conversationId: string }
          messages: Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>
        }

        const { messages } = detailData
        if (!messages || messages.length === 0) return

        // Hydrate msgs from persisted messages, replacing the canned greeting
        const hydrated: HumMessage[] = messages.map((m) => ({
          from: m.role === 'assistant' ? 'hum' : 'you',
          text: m.text,
          time: m.timestamp ? new Date(m.timestamp).toISOString().slice(11, 16) + ' UTC' : undefined,
        }))

        setConversationId(mostRecent.conversationId)
        setMsgs(hydrated)
      } catch {
        // best-effort — a persistence failure must not break the chat UX
      }
    }

    restore()
  }, [open])

  // ── Fetch quota when panel opens ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    fetch('/api/hum/quota')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setQuota(data as { allowed: boolean; used: number; limit: number | null; plan: string }) })
      .catch(() => { /* best-effort */ })
  }, [open])

  // ── Fetch previous conversations when the Previous Chats tab becomes active ─
  useEffect(() => {
    if (activeTab !== 'previous') return

    async function fetchConversations() {
      try {
        const res = await fetch('/api/hum/conversations')
        if (!res.ok) return
        const data = await res.json() as { conversations: ConversationSummary[] }
        if (data.conversations) {
          setPrevConversations(data.conversations)
        }
      } catch {
        // best-effort — failure just shows empty state
      }
    }

    fetchConversations()
  }, [activeTab])

  useEffect(() => {
    if (presetQuestion === undefined) return
    // setState inside a microtask to avoid the synchronous setState-in-effect lint rule
    queueMicrotask(() => {
      setActiveTab('current')
      setInput(presetQuestion)
      onPresetConsumed?.()
    })
    const t = setTimeout(() => composerRef.current?.focus(), 60)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetQuestion])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [msgs, thinking])

  // ── Listen for hum:add-context events (click path from card menus) ────────
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail
      const item = fromCardEvent(detail)
      if (item) {
        addStaged(item)
      }
    }
    window.addEventListener('hum:add-context', handler)
    return () => window.removeEventListener('hum:add-context', handler)
  }, [])

  function addStaged(item: HumStagedContext) {
    setStagedContext((prev) => {
      if (prev.some((s) => s.id === item.id)) return prev
      return [...prev, item]
    })
  }

  function removeStaged(id: string) {
    setStagedContext((prev) => prev.filter((s) => s.id !== id))
  }

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/hum/conversations/${id}`)
      if (!res.ok) return
      const data = await res.json() as {
        conversation: { conversationId: string }
        messages: Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>
      }
      const { messages } = data
      if (!messages || messages.length === 0) return

      const hydrated: HumMessage[] = messages.map((m) => ({
        from: m.role === 'assistant' ? 'hum' : 'you',
        text: m.text,
        time: m.timestamp ? new Date(m.timestamp).toISOString().slice(11, 16) + ' UTC' : undefined,
      }))

      setConversationId(id)
      setMsgs(hydrated)
      loadedRef.current = true
      setActiveTab('current')
    } catch {
      // best-effort
    }
  }

  function startNewChat() {
    setMsgs([INITIAL_MSG])
    setConversationId(null)
    setStagedContext([])
    loadedRef.current = true
    setActiveTab('current')
  }

  async function send(text: string) {
    if (!text.trim() && stagedContext.length === 0) return
    const attached = stagedContext
    setStagedContext([])
    const userMsg: HumMessage = {
      from: 'you',
      text: text.trim() || '(context attached)',
      ...(attached.length ? { contextItems: attached.map((i) => ({ label: i.label })) } : {}),
    }
    setMsgs((m) => [...m, userMsg])
    setInput('')
    setThinking(true)

    // ── Ensure a conversation exists, persist the user message ─────────────
    let activeConversationId = conversationId
    try {
      if (activeConversationId === null) {
        const createRes = await fetch('/api/hum/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: (text || attached[0]?.label || 'Context').slice(0, 60) }),
        })
        if (createRes.ok) {
          const createData = await createRes.json() as { conversation: { conversationId: string } }
          activeConversationId = createData.conversation.conversationId
          setConversationId(activeConversationId)
        }
      }

      if (activeConversationId) {
        await fetch(`/api/hum/conversations/${activeConversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            text: text || '(context attached)',
            ...(attached.length ? { contextItems: attached } : {}),
          }),
        })
      }
    } catch {
      // best-effort — persistence failure must not break chat UX
    }

    try {
      const res = await fetch('/api/hum/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || '(context attached)',
          history: msgs,
          ...(attached.length ? { contextItems: attached } : {}),
        }),
      })

      if (res.status === 402) {
        const body = await res.json() as { used: number; limit: number | null; plan: string }
        setQuota({ allowed: false, used: body.used, limit: body.limit, plan: body.plan })
        setThinking(false)
        return
      }

      if (!res.ok) throw new Error('API error')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let replyMeta: { model?: string; tokensIn?: number; tokensOut?: number } | null = null
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
                if (parsed.meta) {
                  replyMeta = parsed.meta
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }
        }
      }

      // ── Persist the assistant reply ──────────────────────────────────────
      if (accumulated && activeConversationId) {
        try {
          await fetch(`/api/hum/conversations/${activeConversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              text: accumulated,
              model: replyMeta?.model ?? 'us.anthropic.claude-sonnet-4-6',
              ...(replyMeta?.tokensIn !== undefined ? { tokensIn: replyMeta.tokensIn } : {}),
              ...(replyMeta?.tokensOut !== undefined ? { tokensOut: replyMeta.tokensOut } : {}),
            }),
          })
        } catch {
          // best-effort
        }
      }

      // Optimistically reflect the usage decrement recorded server-side.
      if (accumulated) {
        setQuota((q) => q ? { ...q, used: q.used + 1, allowed: q.limit === null || q.used + 1 < q.limit } : q)
      }
    } catch {
      setThinking(false)
      setMsgs((m) => [...m, {
        from: 'hum',
        text: "Sorry, I'm having trouble connecting right now. Try again in a moment.",
        time: new Date().toISOString().slice(11, 16) + ' UTC',
      }])
    }
  }

  return (
    <aside
      style={{
        width: '100%', height: '100%', flexShrink: 0,
        borderLeft: '1px solid var(--border)', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        outline: dragHover ? '2px dashed var(--buzz-500)' : 'none',
        outlineOffset: -2,
        position: 'relative',
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(HUM_CONTEXT_MIME)) {
          e.preventDefault()
          setDragHover(true)
        }
      }}
      onDragLeave={() => setDragHover(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(HUM_CONTEXT_MIME)
        const item = parseContext(raw)
        if (item) {
          e.preventDefault()
          addStaged(item)
        }
        setDragHover(false)
      }}
    >
      {/* Drop overlay hint */}
      {dragHover && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'color-mix(in srgb, var(--buzz-500) 8%, transparent)',
          pointerEvents: 'none',
        }}>
          <span style={{ font: '600 13px var(--font-sans)', color: 'var(--buzz-500)', background: 'var(--bg)', padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--buzz-500)' }}>
            Drop to add context
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ background: 'var(--inv-bg)', color: 'var(--inv-fg)', fontFamily: 'var(--font-display)', fontSize: 14, padding: '4px 8px 2px', lineHeight: 1 }}>HUM.</div>
        <div style={{ flex: 1, lineHeight: 1.2 }}>
          <div style={{ font: '600 13px var(--font-sans)' }}>Research assistant</div>
          <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>reads X · reads chain · doesn&apos;t sleep</div>
        </div>
        <Icon name="close" size={16} style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={onClose} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['current', 'previous'] as const).map((tab) => {
          const isActive = activeTab === tab
          const label = tab === 'current' ? 'Current chat' : 'Previous chats'
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--buzz-500)' : '2px solid transparent',
                padding: '8px 12px',
                cursor: 'pointer',
                font: '500 11px var(--font-sans)',
                color: isActive ? 'var(--fg-1)' : 'var(--fg-3)',
                letterSpacing: '0.01em',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Current chat tab */}
      {activeTab === 'current' && (
        <>
          {/* Conversation */}
          <div
            ref={scrollRef}
            style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {msgs.map((m, i) => <HumBubble key={i} msg={m} />)}
            {thinking && <Thinking />}
          </div>

          {/* Suggestions — only for a brand-new empty chat */}
          {conversationId === null && msgs.length === 1 && !thinking && (
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

          {/* Composer / upgrade CTA */}
          {quota && !quota.allowed ? (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
              <div style={{ font: '600 13px var(--font-sans)', color: 'var(--fg-1)' }}>
                You&apos;ve reached your monthly Hum limit
              </div>
              <div style={{ font: '400 12px var(--font-sans)', color: 'var(--fg-3)' }}>
                {quota.used} / {quota.limit} queries used this month
              </div>
              <button
                onClick={() => openUpgrade({ currentPlan: quota.plan as Plan, onClose: refreshQuota })}
                style={{ background: 'var(--buzz-500)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', font: '600 13px var(--font-sans)', cursor: 'pointer' }}
              >
                Upgrade plan
              </button>
            </div>
          ) : (
            <div style={{ padding: 14, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {/* Staged context chips */}
              {stagedContext.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {stagedContext.map((item) => (
                    <span
                      key={item.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '500 11px var(--font-mono)', color: 'var(--fg-3)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 4px 2px 7px', borderRadius: 999 }}
                    >
                      {item.label}
                      <button
                        onClick={() => removeStaged(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 12, lineHeight: 1, padding: 0 }}
                        aria-label={`Remove ${item.label}`}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder="Ask about a ticker, a handle, a narrative..."
                  rows={1}
                  style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--fg-1)', maxHeight: 100 }}
                />
                <button
                  onClick={() => send(input)}
                  style={{ background: (input.trim() || stagedContext.length > 0) ? 'var(--buzz-500)' : 'var(--ink-300)', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Icon name="send" size={14} />
                </button>
              </div>
              {quota && quota.limit !== null && (
                <div style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)', marginTop: 6, textAlign: 'center' }}>
                  {quota.used} / {quota.limit} this month
                </div>
              )}
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)', marginTop: quota && quota.limit !== null ? 4 : 8, textAlign: 'center' }}>
                Hum cites every source. Always verify before you trade.
              </div>
            </div>
          )}
        </>
      )}

      {/* Previous chats tab */}
      {activeTab === 'previous' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* New chat button */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={startNewChat}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                font: '600 12px var(--font-sans)',
                color: 'var(--fg-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              New chat
            </button>
          </div>

          {/* Conversations list */}
          {prevConversations.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <span style={{ font: '400 13px var(--font-sans)', color: 'var(--fg-3)', textAlign: 'center' }}>
                No previous chats yet.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {prevConversations.map((conv) => {
                const isActive = conv.conversationId === conversationId
                return (
                  <button
                    key={conv.conversationId}
                    onClick={() => loadConversation(conv.conversationId)}
                    style={{
                      background: isActive ? 'var(--surface-active, var(--surface))' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        font: '600 13px var(--font-sans)',
                        color: 'var(--fg-1)',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {conv.title}
                      </span>
                      <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)', flexShrink: 0 }}>
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                    </div>
                    {conv.preview && (
                      <span style={{
                        font: '400 12px var(--font-sans)',
                        color: 'var(--fg-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                      }}>
                        {conv.preview}
                      </span>
                    )}
                    <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>
                      {conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
