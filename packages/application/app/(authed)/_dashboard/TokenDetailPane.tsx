'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Avatar, Delta, fmtCount, fmtPrice } from './primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Token, OHLCVBar, LiveFeedTweet } from './types'
import { CandleChart } from './CandleChart'
import { fromChart } from './humContext'

// Sentiment is classified by a DynamoDB Stream lambda; poll after ingest to wait
// for it to catch up. Stop when >= half the returned tweets have sentiment set.
const SENTIMENT_POLL_INTERVAL_MS = 3000
const SENTIMENT_POLL_MAX_ATTEMPTS = 6
const SENTIMENT_READY_THRESHOLD = 0.5

// ── Sentiment Meter ────────────────────────────────────────────────────────

function SentimentMeter({ score, width = 200 }: { score: number; width?: number }) {
  const angle = Math.max(-90, Math.min(90, (score / 100) * 90))
  const r = 70
  const cx = width / 2, cy = 90
  const startA = -Math.PI
  const fillEndA = -Math.PI + ((angle + 90) / 180) * Math.PI
  const polar = (ang: number, rad: number): [number, number] => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]
  const [sx, sy] = polar(startA, r)
  const [ex, ey] = polar(fillEndA, r)
  const [bx, by] = polar(0, r)
  const largeArc = fillEndA - startA > Math.PI ? 1 : 0
  const color = score > 20 ? 'var(--pos)' : score < -20 ? 'var(--neg)' : 'var(--neu)'
  return (
    <svg viewBox={`0 0 ${width} 100`} width={width} style={{ display: 'block' }}>
      <path d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${bx} ${by}`} fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M${sx} ${sy} A${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      <g transform={`translate(${cx} ${cy}) rotate(${angle})`}>
        <line x1="0" y1="0" x2="0" y2={-r + 12} stroke="var(--fg-1)" strokeWidth="2.5" strokeLinecap="round" />
        <circle r="4" fill="var(--fg-1)" />
      </g>
    </svg>
  )
}

// ── Mention Card ───────────────────────────────────────────────────────────

interface MentionShape {
  handle: string
  followers: string
  time: string
  sent: 'bull' | 'bear' | 'neu'
  text: string
}

function MentionCard({ m }: { m: MentionShape }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Avatar name={m.handle.replace('@', '')} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ font: '600 13px var(--font-sans)' }}>{m.handle}</span>
          <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{m.followers}</span>
          <span style={{ color: 'var(--fg-4)' }}>·</span>
          <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{m.time}</span>
          <div style={{ flex: 1 }} />
          {m.sent === 'bull' && <Pill tone="bull">▲</Pill>}
          {m.sent === 'bear' && <Pill tone="bear">▼</Pill>}
          {m.sent === 'neu'  && <Pill tone="neu">◆</Pill>}
        </div>
        <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-1)' }}>{m.text}</div>
      </div>
    </div>
  )
}

// ── Set Alert Modal ────────────────────────────────────────────────────────

type AlertCondition = 'mention_spike' | 'sentiment_swing' | 'price_move'
type AlertTarget = 'bull' | 'bear' | 'any'

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: 'mention_spike',   label: 'Buzz spike' },
  { value: 'sentiment_swing', label: 'Sentiment flip' },
  { value: 'price_move',      label: 'Price move' },
]

const TARGETS: { value: AlertTarget; label: string }[] = [
  { value: 'any',  label: 'Any' },
  { value: 'bull', label: 'Bull' },
  { value: 'bear', label: 'Bear' },
]

function SetAlertModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [condition, setCondition] = useState<AlertCondition>('mention_spike')
  const [threshold, setThreshold] = useState('100')
  const [target, setTarget] = useState<AlertTarget>('any')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const isMobile = useIsMobile()

  const needsThreshold = condition === 'mention_spike' || condition === 'price_move'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { symbol, condition }
      if (needsThreshold) body.threshold = Number(threshold)
      if (condition === 'sentiment_swing') body.target = target

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({ error: `Request failed: ${res.status}` })) as Record<string, unknown>
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Request failed: ${res.status}`)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
  }

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: isMobile ? '12px 12px 0 0' : 10,
    width: isMobile ? '100%' : 400,
    padding: '24px 24px 28px',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ font: '600 16px var(--font-sans)', color: 'var(--fg-1)', flex: 1 }}>
            Set alert · <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>${symbol}</span>
          </span>
          <Button variant="quiet" size="sm" icon="close" onClick={onClose} />
        </div>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <div style={{ font: '600 15px var(--font-sans)', color: 'var(--pos)' }}>Alert created</div>
            <div style={{ font: '400 13px var(--font-sans)', color: 'var(--fg-3)', textAlign: 'center' }}>
              You will be notified in-app when the condition triggers.
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Condition selector */}
              <div>
                <Eyebrow style={{ marginBottom: 8 }}>Condition</Eyebrow>
                <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, gap: 2 }}>
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCondition(c.value)}
                      style={{
                        border: 'none', padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                        font: '600 11px var(--font-sans)',
                        background: condition === c.value ? 'var(--bg-elevated)' : 'transparent',
                        color: condition === c.value ? 'var(--fg-1)' : 'var(--fg-2)',
                        boxShadow: condition === c.value ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Threshold (not shown for sentiment_swing) */}
              {needsThreshold && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Eyebrow>Threshold (%)</Eyebrow>
                  <input
                    type="number"
                    min="0"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    style={{
                      font: '500 14px var(--font-mono)', padding: '9px 12px',
                      border: '1px solid var(--border-strong)', borderRadius: 6,
                      background: 'var(--bg-sunken)', color: 'var(--fg-1)', outline: 'none', width: 120,
                    }}
                  />
                </label>
              )}

              {/* Target (only for sentiment_swing) */}
              {condition === 'sentiment_swing' && (
                <div>
                  <Eyebrow style={{ marginBottom: 8 }}>Direction</Eyebrow>
                  <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, gap: 2 }}>
                    {TARGETS.map((tgt) => (
                      <button
                        key={tgt.value}
                        type="button"
                        onClick={() => setTarget(tgt.value)}
                        style={{
                          border: 'none', padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                          font: '600 11px var(--font-sans)',
                          background: target === tgt.value ? 'var(--bg-elevated)' : 'transparent',
                          color: target === tgt.value ? 'var(--fg-1)' : 'var(--fg-2)',
                          boxShadow: target === tgt.value ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                        }}
                      >{tgt.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ font: '500 12px var(--font-sans)', color: 'var(--neg)' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Create alert'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`
  return `${Math.floor(secs / 86400)}d`
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k'
  return String(n)
}

// ── /api/query response types ──────────────────────────────────────────────

interface QuerySuccess {
  ingested: number
  query: string
  bySource: Record<string, number>
}

interface QueryError {
  error: string
  reason?: string
  detail?: string
}

type QueryResponse = QuerySuccess | QueryError

function isQueryError(r: QueryResponse): r is QueryError {
  return 'error' in r
}

// Guard: skip POST /api/query if this exact query was triggered within 5 minutes
const INGEST_COOLDOWN_MS = 5 * 60 * 1000

function getLastIngestTime(query: string): number | null {
  try {
    const raw = sessionStorage.getItem(`watchlist:lastIngest:${query}`)
    return raw ? parseInt(raw, 10) : null
  } catch {
    return null
  }
}

function setLastIngestTime(query: string): void {
  try {
    sessionStorage.setItem(`watchlist:lastIngest:${query}`, String(Date.now()))
  } catch {
    // sessionStorage unavailable (e.g. incognito with blocked storage) — degrade gracefully
  }
}

// ── Pane-level data ────────────────────────────────────────────────────────

interface PaneData {
  price: number
  d24: number
  mentions: number
  uniqueHandles: number
  sentimentScore: number
  mentions24hDelta: number
  tweets: LiveFeedTweet[]
}

// ── Token Profile (links) ──────────────────────────────────────────────────

interface TokenProfile {
  websiteUrl?: string
  pressUrl?: string
  githubUrl?: string
  contractAddress?: string
  chain?: string
}

// ── Feed item ──────────────────────────────────────────────────────────────

interface FeedItem {
  title: string
  link: string
  summary?: string
  sourceName: string
  publishedAt: string
}

// ── Token Detail Pane ──────────────────────────────────────────────────────

interface TokenDetailPaneProps {
  token: Token
  onClose?: () => void
  onAskHum?: (question: string) => void
  // Controlled expand state — managed by the parent page (desktop only)
  expanded?: boolean
  onToggleExpand?: () => void
  // Current pixel width of the pane; used to reflow chart+dial layout on desktop
  paneWidth?: number
}

export function TokenDetailPane({ token, onClose, onAskHum, expanded, onToggleExpand, paneWidth }: TokenDetailPaneProps) {
  const [paneData, setPaneData] = useState<PaneData | null>(null)
  const [paneLoading, setPaneLoading] = useState(true)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [ingestError, setIngestError] = useState<React.ReactNode | null>(null)
  const [profile, setProfile] = useState<TokenProfile | null>(null)
  const [pressItems, setPressItems] = useState<FeedItem[]>([])
  const isMobile = useIsMobile()

  // Ref to abort stale in-flight fetches when the token changes mid-load
  const abortRef = useRef<AbortController | null>(null)
  // Ref used to cancel the sentiment poll loop on unmount or token switch
  const sentimentPollRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  // Reads /api/live-feed and merges into paneData, preserving price fields
  async function fetchLiveFeed(
    query: string,
    priceOverride: { price: number; d24: number },
    signal?: AbortSignal,
  ): Promise<PaneData | null> {
    try {
      const res = await fetch(
        `/api/live-feed?token=${encodeURIComponent(query)}&limit=200`,
        signal ? { signal } : {},
      )
      if (!res.ok) return null
      const data = await res.json() as { tweets?: LiveFeedTweet[] }
      const tweets = data.tweets ?? []
      const handles = new Set(tweets.map((t) => t.authorUsername)).size
      const bullCount = tweets.filter((t) => t.sentiment === 'bull').length
      const bearCount = tweets.filter((t) => t.sentiment === 'bear').length
      const total = tweets.length
      const rawScore = total > 0 ? ((bullCount - bearCount) / total) * 100 : 0
      const sentimentScore = Math.max(-100, Math.min(100, Math.round(rawScore)))
      const half = Math.floor(total / 2)
      const recent = total - half
      const delta = half > 0 ? Math.round(((recent - half) / half) * 100) : 0
      return {
        price: priceOverride.price,
        d24: priceOverride.d24,
        mentions: total,
        uniqueHandles: handles,
        sentimentScore,
        mentions24hDelta: delta,
        tweets,
      }
    } catch {
      return null
    }
  }

  // Fires POST /api/query and returns the parsed response (or null on network error)
  async function triggerIngest(query: string, signal?: AbortSignal): Promise<QueryResponse | null> {
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources: ['twitter'], maxPages: 2 }),
        ...(signal ? { signal } : {}),
      })
      const json = await res.json().catch(() => ({ error: `status ${res.status}` })) as QueryResponse
      if (!res.ok) {
        // Return a typed error so callers can inspect status + body together
        const err: QueryError = isQueryError(json)
          ? json
          : { error: `status ${res.status}` }
        return err
      }
      return json as QuerySuccess
    } catch {
      // Network error — fall back silently
      return null
    }
  }

  // Resolves an error response to a user-facing message node (null = silent)
  function resolveIngestError(status: QueryResponse | null, httpStatus?: number): React.ReactNode | null {
    if (status === null) return null // network error — silent
    if (!isQueryError(status)) return null // success
    const { error, reason } = status
    if (error === 'quota_exhausted' || httpStatus === 402) {
      return 'Daily query quota exhausted. Showing cached data.'
    }
    if (error === 'byok_required' || httpStatus === 403) {
      return (
        <>
          Connect a Twitter API key in <Link href="/account" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Account</Link> to load live mentions.
        </>
      )
    }
    if (httpStatus === 429) {
      return 'Rate limited upstream — try again shortly.'
    }
    if (httpStatus === 502) {
      return 'Couldn\'t reach the social provider. Showing cached data.'
    }
    if (httpStatus === 401) {
      return null // shouldn't happen on authed pages
    }
    return null
  }

  // After a successful ingest, poll live-feed until sentiment has propagated.
  // Sentiment is written back by a DynamoDB Stream lambda — it lags the tweet write
  // by a few seconds. Poll for up to SENTIMENT_POLL_MAX_ATTEMPTS * SENTIMENT_POLL_INTERVAL_MS.
  const startSentimentPoll = useCallback(
    (query: string, priceOverride: { price: number; d24: number }, guard: { cancelled: boolean }) => {
      let attempts = 0
      const tick = async () => {
        if (guard.cancelled) return
        attempts++
        const fresh = await fetchLiveFeed(query, priceOverride)
        if (guard.cancelled) return

        if (fresh) {
          setPaneData(fresh)
          // Check if enough tweets now carry sentiment
          const withSentiment = fresh.tweets.filter((t) => t.sentiment != null).length
          const total = fresh.tweets.length
          const ready = total > 0 && withSentiment / total >= SENTIMENT_READY_THRESHOLD
          if (ready || attempts >= SENTIMENT_POLL_MAX_ATTEMPTS) {
            setRefreshing(false)
            return
          }
        } else if (attempts >= SENTIMENT_POLL_MAX_ATTEMPTS) {
          setRefreshing(false)
          return
        }

        setTimeout(tick, SENTIMENT_POLL_INTERVAL_MS)
      }
      // Start the first poll after the first interval
      setTimeout(tick, SENTIMENT_POLL_INTERVAL_MS)
    },
    // fetchLiveFeed is a plain function in component scope; all data flows through params
    [],
  )

  // Core ingestion + re-fetch flow. forceRefresh=true bypasses the 5-min cooldown.
  async function runIngest(
    query: string,
    priceOverride: { price: number; d24: number },
    forceRefresh: boolean,
    signal?: AbortSignal,
  ) {
    const last = getLastIngestTime(query)
    const withinCooldown = last !== null && Date.now() - last < INGEST_COOLDOWN_MS

    if (!withinCooldown || forceRefresh) {
      setRefreshing(true)
      setIngestError(null)

      let httpStatus: number | undefined
      let result: QueryResponse | null = null
      let ingestOk = false
      try {
        // We need the HTTP status to map error codes correctly, so re-fetch directly
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, sources: ['twitter'], maxPages: 2 }),
          ...(signal ? { signal } : {}),
        })
        httpStatus = res.status
        result = await res.json().catch(() => ({ error: `status ${res.status}` })) as QueryResponse

        if (res.ok) {
          setLastIngestTime(query)
          ingestOk = true
        }
      } catch {
        // Network error — silent fallback
      }

      if (signal?.aborted) return

      // Map the API response to a user-facing error node
      const errNode = resolveIngestError(result, httpStatus)
      setIngestError(errNode)

      // Re-fetch live-feed with fresh data from the just-completed ingest
      const fresh = await fetchLiveFeed(query, priceOverride, signal)
      if (signal?.aborted) return
      if (fresh) {
        setPaneData(fresh)
      }

      if (ingestOk) {
        // Ingest succeeded — start polling until the sentiment lambda catches up.
        // Cancel guard: reuses the sentimentPollRef so switching tokens stops the old poll.
        sentimentPollRef.current.cancelled = true
        const guard = { cancelled: false }
        sentimentPollRef.current = guard
        startSentimentPoll(query, priceOverride, guard)
        // setRefreshing(false) is called inside startSentimentPoll when polling ends
      } else {
        setRefreshing(false)
      }
    }
  }

  // Re-fetch whenever the token changes
  useEffect(() => {
    // Cancel any in-flight requests for the previous token
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    async function load() {
      if (!token.query) {
        setPaneLoading(false)
        return
      }
      setPaneLoading(true)
      setPaneData(null)
      setIngestError(null)

      const query = token.query
      let price = token.price
      let d24 = token.d24

      // Fetch price + cached live-feed in parallel; kick off ingest concurrently
      const [priceRes, feedRes] = await Promise.allSettled([
        fetch(`/api/price/${encodeURIComponent(token.sym)}?interval=1d`, { signal: ac.signal }),
        fetch(`/api/live-feed?token=${encodeURIComponent(query)}&limit=200`, { signal: ac.signal }),
      ])

      if (ac.signal.aborted) return

      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const data = await priceRes.value.json() as { bars?: OHLCVBar[] }
        const bars = data.bars ?? []
        if (bars.length >= 2) {
          const last = bars[bars.length - 1]
          const prev = bars[bars.length - 2]
          price = last.close
          d24 = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0
        }
      }

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const data = await feedRes.value.json() as { tweets?: LiveFeedTweet[] }
        const tweets = data.tweets ?? []
        const handles = new Set(tweets.map((t) => t.authorUsername)).size
        const bullCount = tweets.filter((t) => t.sentiment === 'bull').length
        const bearCount = tweets.filter((t) => t.sentiment === 'bear').length
        const total = tweets.length
        const rawScore = total > 0 ? ((bullCount - bearCount) / total) * 100 : 0
        const sentimentScore = Math.max(-100, Math.min(100, Math.round(rawScore)))
        const half = Math.floor(total / 2)
        const recent = total - half
        const delta = half > 0 ? Math.round(((recent - half) / half) * 100) : 0

        setPaneData({ price, d24, mentions: total, uniqueHandles: handles, sentimentScore, mentions24hDelta: delta, tweets })
      } else {
        setPaneData({
          price, d24,
          mentions: token.mentions, uniqueHandles: 0,
          sentimentScore: token.sent === 'bull' ? 62 : token.sent === 'bear' ? -48 : 8,
          mentions24hDelta: token.dbuzz,
          tweets: [],
        })
      }

      setPaneLoading(false)

      // Kick off on-demand ingestion in the background (doesn't block pane header)
      void runIngest(query, { price, d24 }, false, ac.signal)
    }

    load().catch(() => {
      if (!ac.signal.aborted) setPaneLoading(false)
    })

    return () => {
      ac.abort()
      // Cancel any in-progress sentiment poll from a previous token
      sentimentPollRef.current.cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.sym, token.query])
  // NOTE: token.price/d24/mentions/dbuzz/sent are intentionally excluded — they are only used
  // as fallback placeholders when the API call fails, and re-running the fetch on every price
  // tick would cause excessive API requests.

  // Fetch token profile (links) whenever the symbol changes
  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      setProfile(null)
      try {
        const res = await fetch(`/api/tokens/${encodeURIComponent(token.sym)}/profile`)
        if (cancelled) return
        if (!res.ok) return
        const data = await res.json() as { profile: TokenProfile | null }
        if (cancelled) return
        setProfile(data.profile ?? null)
      } catch {
        // On error, leave profile null — links block hidden
      }
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [token.sym])

  // Fetch press feed items whenever the symbol changes
  useEffect(() => {
    let cancelled = false
    async function loadPressItems() {
      setPressItems([])
      try {
        const res = await fetch(`/api/tokens/${encodeURIComponent(token.sym)}/feed?kind=PRESS&limit=10`)
        if (cancelled) return
        if (!res.ok) { setPressItems([]); return }
        const data = await res.json() as { items: FeedItem[] }
        if (cancelled) return
        setPressItems(data.items ?? [])
      } catch {
        // On error, leave empty
        if (!cancelled) setPressItems([])
      }
    }
    void loadPressItems()
    return () => { cancelled = true }
  }, [token.sym])

  const price = paneData?.price ?? (paneLoading ? null : token.price)
  const d24 = paneData?.d24 ?? token.d24
  const mentions = paneData?.mentions ?? token.mentions
  const uniqueHandles = paneData?.uniqueHandles ?? 0
  const sentimentScore = paneData?.sentimentScore ?? (token.sent === 'bull' ? 62 : token.sent === 'bear' ? -48 : 8)
  const mentions24hDelta = paneData?.mentions24hDelta ?? token.dbuzz

  const scoreColor = sentimentScore > 20 ? 'var(--pos)' : sentimentScore < -20 ? 'var(--neg)' : 'var(--neu)'

  // Map live tweets to mention card shape
  const mentionCards: MentionShape[] = (paneData?.tweets ?? []).map((tw) => ({
    handle: `@${tw.authorUsername}`,
    followers: fmtFollowers(0), // authorFollowers not exposed on LiveFeedTweet
    time: timeSince(tw.createdAt),
    sent: (tw.sentiment === 'bull' || tw.sentiment === 'bear') ? tw.sentiment : 'neu',
    text: tw.text,
  }))

  // Manual refresh: bypass cooldown and re-trigger ingest
  function handleManualRefresh() {
    if (!token.query || refreshing) return
    const priceNow = { price: paneData?.price ?? token.price, d24: paneData?.d24 ?? token.d24 }
    void runIngest(token.query, priceNow, true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--inv-bg)', color: 'var(--inv-fg)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
          {token.sym.slice(0, 2)}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ font: '600 22px var(--font-sans)' }}>${token.sym}</span>
            {token.live && <Pill tone="accent" live>Live</Pill>}
          </div>
          <div style={{ font: '500 13px var(--font-sans)', color: 'var(--fg-3)' }}>{token.name}</div>
        </div>
        <div style={{ flex: 1 }} />
        <Button
          variant="ghost" size="sm" icon="bell"
          onClick={() => setShowAlertModal(true)}
        >{isMobile ? null : 'Set alert'}</Button>
        <Button variant="primary" size="sm" icon="sparkle" onClick={() => {
          const ctx = fromChart({ symbol: token.sym, interval: '1h' })
          window.dispatchEvent(new CustomEvent('hum:add-context', { detail: ctx }))
          onAskHum?.(`What's driving $${token.sym} buzz?`)
        }}>{isMobile ? null : 'Ask Hum'}</Button>
        {/* Expand/collapse toggle — desktop only; mobile pane is already full-screen */}
        {!isMobile && onToggleExpand != null && (
          <Button
            variant="quiet"
            size="sm"
            icon={expanded ? 'compress' : 'expand'}
            onClick={onToggleExpand}
            aria-label={expanded ? 'Collapse pane' : 'Expand pane'}
          />
        )}
        <Button variant="quiet" size="sm" icon="close" onClick={onClose} />
      </div>

      {/* Stat strip — 4-col on desktop/tablet, 2×2 on mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {[
          {
            l: 'Price',
            v: price !== null ? fmtPrice(price) : '—',
            s: <Delta value={d24} style={{ fontSize: 13 }} />,
          },
          {
            l: 'Mentions / 24h',
            v: paneLoading ? '—' : fmtCount(mentions),
            s: <Delta value={mentions24hDelta} style={{ fontSize: 13 }} />,
          },
          {
            l: 'Unique handles',
            v: paneLoading ? '—' : fmtCount(uniqueHandles),
            s: null,
          },
          {
            l: 'Sentiment',
            v: paneLoading ? '—' : <span style={{ color: scoreColor }}>{sentimentScore > 0 ? '+' : ''}{sentimentScore}</span>,
            s: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>of 100</span>,
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              padding: isMobile ? '12px 14px' : '14px 20px',
              minWidth: 0,
              borderRight: isMobile
                ? (i % 2 === 0 ? '1px solid var(--border-hairline)' : 'none')
                : (i < 3 ? '1px solid var(--border-hairline)' : 'none'),
              borderBottom: isMobile && i < 2 ? '1px solid var(--border-hairline)' : 'none',
            }}
          >
            <Eyebrow style={{ marginBottom: 6 }}>{c.l}</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                font: `600 ${isMobile ? 18 : 22}px var(--font-mono)`,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.01em',
              }}>{c.v}</span>
              {c.s}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + sentiment dial — side-by-side when wide enough, stacked on mobile or narrow pane */}
      <div style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns: (isMobile || (paneWidth !== undefined && paneWidth < 580)) ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 240px',
        gap: 16,
        flexShrink: 0,
      }}>
        <CandleChart symbol={token.sym} height={340} />
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: isMobile ? 'center' : 'flex-start',
        }}>
          <Eyebrow>Sentiment dial</Eyebrow>
          <SentimentMeter score={sentimentScore} width={200} />
          <div style={{ textAlign: 'center', font: '600 18px var(--font-mono)', color: scoreColor }}>
            {sentimentScore > 20 ? '▲ Bullish' : sentimentScore < -20 ? '▼ Bearish' : '◆ Mixed'} · {sentimentScore > 0 ? '+' : ''}{sentimentScore}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11px var(--font-mono)', color: 'var(--fg-3)', width: 200 }}>
            <span>bear</span><span>mixed</span><span>bull</span>
          </div>
        </div>
      </div>

      {/* Links */}
      {profile && (profile.websiteUrl || profile.pressUrl || profile.githubUrl || profile.contractAddress) && (
        <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
          <Eyebrow style={{ marginBottom: 10 }}>Links</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 10px', fontFamily: 'var(--font-mono)',
                  fontSize: 12, color: 'var(--fg-2)', textDecoration: 'none',
                }}
              >
                <Icon name="globe" size={14} />
                Website
              </a>
            )}
            {profile.pressUrl && (
              <a
                href={profile.pressUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 10px', fontFamily: 'var(--font-mono)',
                  fontSize: 12, color: 'var(--fg-2)', textDecoration: 'none',
                }}
              >
                <Icon name="book" size={14} />
                Newsroom
              </a>
            )}
            {profile.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 10px', fontFamily: 'var(--font-mono)',
                  fontSize: 12, color: 'var(--fg-2)', textDecoration: 'none',
                }}
              >
                <Icon name="github" size={14} />
                GitHub
              </a>
            )}
            {profile.contractAddress && (
              <span
                title={profile.contractAddress}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 10px', fontFamily: 'var(--font-mono)',
                  fontSize: 12, color: 'var(--fg-2)',
                }}
              >
                <Icon name="doc" size={14} />
                {profile.chain ? `${profile.chain} · ` : ''}
                {profile.contractAddress.slice(0, 6)}…{profile.contractAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent press */}
      {pressItems.length > 0 && (
        <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
          <Eyebrow style={{ marginBottom: 10 }}>Recent press</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {pressItems.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  borderBottom: i < pressItems.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                }}
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    font: '500 13px var(--font-sans)',
                    color: 'var(--fg-1)',
                    textDecoration: 'none',
                    display: 'block',
                    marginBottom: 3,
                    lineHeight: 1.4,
                  }}
                >
                  {item.title}
                </a>
                {item.summary && (
                  <p style={{
                    font: '400 12px/1.4 var(--font-sans)',
                    color: 'var(--fg-2)',
                    margin: '0 0 4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {item.summary}
                  </p>
                )}
                <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{item.sourceName}</span>
                  <span style={{ color: 'var(--fg-4)' }}>·</span>
                  <span>{timeSince(item.publishedAt)} ago</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mentions */}
      <div style={{ padding: '0 20px 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eyebrow>Live mentions · sorted by reach</Eyebrow>
            {/* Refreshing pill shown while on-demand ingest is in flight */}
            {refreshing && (
              <Pill tone="neu">Refreshing...</Pill>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Manual refresh button — bypasses 5-min cooldown */}
            {!paneLoading && (
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: refreshing ? 'default' : 'pointer',
                  font: '500 11px var(--font-mono)', color: refreshing ? 'var(--fg-4)' : 'var(--accent)',
                  textDecoration: 'underline',
                }}
              >
                Refresh
              </button>
            )}
            {paneLoading && <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>loading…</span>}
            {!paneLoading && !refreshing && mentionCards.length === 0 && !ingestError && (
              <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>no recent mentions</span>
            )}
          </div>
        </div>

        {/* Inline ingest error — shown once, non-blocking */}
        {ingestError && (
          <div style={{
            font: '500 12px var(--font-sans)', color: 'var(--fg-2)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', marginBottom: 10,
          }}>
            {ingestError}
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {mentionCards.map((m, i) => <MentionCard key={i} m={m} />)}
        </div>
      </div>

      {/* Set Alert modal */}
      {showAlertModal && (
        <SetAlertModal
          symbol={token.sym}
          onClose={() => setShowAlertModal(false)}
        />
      )}
    </div>
  )
}
