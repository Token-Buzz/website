'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Icon, Button, Eyebrow, Ticker, BuzzDot,
  Card, SectionHead, fmtCount, Avatar,
} from './primitives'
import type { StreamPost, AlertItem } from './types'
import {
  relativeTime,
  derivePulseMpm,
  derivePulseAvg,
  deriveHeadline,
  mapTweetsToStream,
  mapApiAlertsToItems,
  mapApiSpikes,
  type TodayApiResponse,
  type LiveFeedTweet,
  type SpikeCardData,
} from './todayData'

// ── API response shape for live-feed ──────────────────────────────────────

interface LiveFeedResponse {
  tweets: LiveFeedTweet[]
  cursor: string | undefined
}

// ── Greeting ───────────────────────────────────────────────────────────────

function Greeting({
  firstName,
  headline,
  alertCount,
}: {
  firstName?: string | null
  headline: string
  alertCount: number
}) {
  const now = new Date()
  const utc = now.toUTCString().replace('GMT', 'UTC').split(' ').slice(0, 5).join(' ')
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 4 }}>
      <div style={{ flex: 1 }}>
        <Eyebrow style={{ marginBottom: 6 }}>Today · {utc}</Eyebrow>
        <div style={{ font: '600 28px/1.15 var(--font-sans)', letterSpacing: '-0.015em' }}>
          {firstName ? `Morning, ${firstName}.` : 'Morning.'}{' '}
          <span style={{ color: 'var(--fg-3)' }}>{headline}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {alertCount > 0 && (
          <Button variant="ghost" size="md" icon="bell">
            {alertCount} new {alertCount === 1 ? 'alert' : 'alerts'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── KPI Strip ──────────────────────────────────────────────────────────────

function KPI({ label, value, foot, accent }: {
  label: string; value: string | number; foot?: string; accent?: string
}) {
  return (
    <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          font: '600 28px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em', color: accent || 'var(--fg-1)',
        }}>{value}</span>
      </div>
      {foot && <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{foot}</div>}
    </Card>
  )
}

function KPIStrip({ kpis }: { kpis: TodayApiResponse['kpis'] }) {
  const sentColor = kpis.netSentiment > 0 ? 'var(--pos)' : kpis.netSentiment < 0 ? 'var(--neg)' : 'var(--neu)'
  const sentStr = kpis.netSentiment >= 0 ? `+${kpis.netSentiment}` : `${kpis.netSentiment}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <KPI label="Mentions · 24h" value={fmtCount(kpis.mentions24h)} foot="global tracked tokens" />
      <KPI label="Tokens tracked" value={kpis.tokenCount} foot="from your watchlist" />
      <KPI label="Alerts fired today" value={kpis.alertCount} foot="in your inbox" accent={kpis.alertCount > 0 ? 'var(--accent)' : undefined} />
      <KPI label="Net sentiment" value={sentStr} foot="bull/bear balance" accent={sentColor} />
    </div>
  )
}

// ── Pulse ──────────────────────────────────────────────────────────────────

function PulseChart({ points, color = 'var(--data-pos)', height = 120 }: { points: number[]; color?: string; height?: number }) {
  if (!points.length) return null
  const w = 800
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const xs = points.length - 1
  const path = points.map((p, i) => {
    const x = (i / xs) * w
    const y = height - ((p - min) / range) * (height - 8) - 4
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const fill = `${path} L${w},${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#pulseFill)" />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

function Pulse({ series, topSpikes }: { series: number[]; topSpikes: SpikeCardData[] }) {
  const mpm = derivePulseMpm(series)
  const avg = derivePulseAvg(series)
  const vsAvgPct = avg > 0 ? Math.round(((mpm - avg) / avg) * 100) : 0
  const vsStr = vsAvgPct >= 0 ? `+${vsAvgPct}%` : `${vsAvgPct}%`
  const loudest = topSpikes.slice(0, 3).map((s) => s.sym)

  return (
    <div style={{
      background: 'var(--data-bg)', color: 'var(--data-fg)',
      border: '1px solid var(--data-line)', borderRadius: 'var(--r-3)',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, #fff 2px, #fff 3px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, position: 'relative' }}>
        <BuzzDot />
        <span style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-amber)' }}>The buzz pulse · live</span>
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)' }}>rolling 60min · global</span>
      </div>

      {series.length === 0 ? (
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--data-dim)', padding: '20px 0' }}>
          No pulse data yet — mentions data will appear as tokens are tracked.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 28, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-dim)', marginBottom: 6 }}>Mentions / min</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ font: '600 48px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: 'var(--data-fg)' }}>{fmtCount(mpm)}</span>
                {vsAvgPct !== 0 && (
                  <span style={{ font: '600 14px var(--font-mono)', color: vsAvgPct > 0 ? 'var(--data-pos)' : 'var(--data-neg)' }}>{vsStr}</span>
                )}
              </div>
              <div style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)', marginTop: 4 }}>vs 60min avg · {fmtCount(avg)}/min</div>
            </div>
            {/* Phase 2: sentiment-split sub-block */}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <PulseChart points={series} />
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 10px var(--font-mono)', color: 'var(--data-dim)' }}>
              <span>−60m</span><span>−45m</span><span>−30m</span><span>−15m</span><span>now</span>
            </div>
            {loudest.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(255,179,71,0.06)', border: '1px solid rgba(255,179,71,0.2)', borderRadius: 6 }}>
                <span style={{ font: '600 10px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-amber)' }}>Loudest right now</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {loudest.map((sym) => <Ticker key={sym} symbol={sym} variant="dark" />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Spikes ─────────────────────────────────────────────────────────────────

function SpikeCard({ t }: { t: SpikeCardData }) {
  const sentColor = t.sentiment === 'bull' ? 'var(--pos)' : t.sentiment === 'bear' ? 'var(--neg)' : 'var(--neu)'
  const sentGlyph = t.sentiment === 'bull' ? '▲' : t.sentiment === 'bear' ? '▼' : '◆'
  return (
    <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ticker symbol={t.sym} />
        <div style={{ flex: 1 }} />
        <BuzzDot />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: '600 24px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {t.deltaScore > 0 ? '+' : ''}{t.deltaScore}%
        </span>
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>buzz · 1H</span>
      </div>
      {/* Phase 2: per-token sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-hairline)', font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>
        <span>{fmtCount(t.mentions)} mentions</span>
        <span style={{ color: sentColor }}>{sentGlyph}</span>
        <Link href="/movers" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
          Open <Icon name="chevR" size={11} />
        </Link>
      </div>
    </Card>
  )
}

function Spikes({ spikes }: { spikes: SpikeCardData[] }) {
  if (spikes.length === 0) return null
  return (
    <section>
      <SectionHead eyebrow="Biggest spikes · last hour" meta="ranked by mention rate Δ" action={<Link href="/movers" style={{ textDecoration: 'none' }}><Button variant="quiet" size="sm">See all movers →</Button></Link>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {spikes.map((t) => <SpikeCard key={t.sym} t={t} />)}
      </div>
    </section>
  )
}

// ── Stream ─────────────────────────────────────────────────────────────────

function StreamItem({ m, isLast }: { m: StreamPost; isLast: boolean }) {
  const sentColor = m.sent === 'bull' ? 'var(--pos)' : m.sent === 'bear' ? 'var(--neg)' : 'var(--neu)'
  const sentGlyph = m.sent === 'bull' ? '▲' : m.sent === 'bear' ? '▼' : '◆'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, padding: '10px 0', alignItems: 'flex-start', borderBottom: isLast ? 'none' : '1px solid var(--border-hairline)' }}>
      <Avatar name={m.handle.replace('@', '')} size={26} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ font: '600 12px var(--font-sans)' }}>{m.handle}</span>
          {m.followers && <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{m.followers}</span>}
          <span style={{ color: 'var(--fg-4)' }}>·</span>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{m.time}</span>
          {m.tick && <Ticker symbol={m.tick} size="sm" />}
        </div>
        <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-1)' }}>{m.text}</div>
      </div>
      <span style={{ color: sentColor, font: '600 12px var(--font-mono)', paddingTop: 4 }}>{sentGlyph}</span>
    </div>
  )
}

function Stream({ stream, loading }: { stream: StreamPost[]; loading: boolean }) {
  if (loading) {
    return (
      <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionHead eyebrow="Live stream · high signal" meta="loading…" />
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--fg-3)', padding: '20px 0' }}>Loading feed…</div>
      </Card>
    )
  }
  if (stream.length === 0) {
    return (
      <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionHead eyebrow="Live stream · high signal" />
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--fg-3)', padding: '20px 0' }}>
          No tweets yet — add tokens to your watchlist to populate your feed.
        </div>
      </Card>
    )
  }
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead
        eyebrow="Live stream · high signal"
        meta="filtered to your watchlist tickers"
        action={<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BuzzDot /><span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>live</span></div>}
      />
      <div>
        {stream.map((m, i) => <StreamItem key={i} m={m} isLast={i === stream.length - 1} />)}
      </div>
    </Card>
  )
}

// ── Alerts Log ─────────────────────────────────────────────────────────────

const ALERT_TONES: Record<string, { glyph: string; color: string }> = {
  buzz:      { glyph: '●', color: 'var(--accent)' },
  sent:      { glyph: '◆', color: 'var(--neu)' },
  handle:    { glyph: '@', color: '#6E5BA3' },
  narrative: { glyph: '✶', color: '#2E7F7B' },
}

function AlertRow({ a, isLast }: { a: AlertItem; isLast: boolean }) {
  const tone = ALERT_TONES[a.tone] ?? ALERT_TONES.buzz
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px 56px 1fr', gap: 10, padding: '10px 0', alignItems: 'flex-start', borderBottom: isLast ? 'none' : '1px solid var(--border-hairline)' }}>
      <span style={{ color: tone.color, font: '600 14px var(--font-mono)', textAlign: 'center' }}>{tone.glyph}</span>
      <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{a.time}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ font: '600 10px var(--font-sans)', letterSpacing: '0.15em', textTransform: 'uppercase', color: tone.color }}>{a.tag}</span>
          <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-1)' }}>{a.target}</span>
        </div>
        <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)' }}>{a.body}</div>
      </div>
    </div>
  )
}

function AlertsLog({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead eyebrow="Alerts fired today" meta={`${alerts.length} triggered`} action={<Button variant="quiet" size="sm">Rules →</Button>} />
      <div>
        {alerts.map((a, i) => <AlertRow key={i} a={a} isLast={i === alerts.length - 1} />)}
      </div>
    </Card>
  )
}

// ── Empty / new-user state ─────────────────────────────────────────────────

function NewUserState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{ font: '600 20px var(--font-sans)', color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
        Welcome to your dashboard
      </div>
      <div style={{ font: '400 14px/1.6 var(--font-sans)', color: 'var(--fg-3)', maxWidth: 400 }}>
        Add tokens to your watchlist to start tracking mentions, sentiment, and alerts.
      </div>
      <Link href="/watchlist" style={{ textDecoration: 'none' }}>
        <Button variant="primary" size="md" icon="plus">Add tokens to watchlist</Button>
      </Link>
    </div>
  )
}

// ── Phase 2–4 components (defined, not yet mounted) ────────────────────────

// Phase 2: SentimentGrid — per-token sentiment heatmap
// function SentimentGrid(...) { ... }

// Phase 3: Narratives — emerging narrative clusters
// function Narratives(...) { ... }

// Phase 4: Brief (HUM) — AI morning brief
// function Brief(...) { ... }

// ── TodayView ──────────────────────────────────────────────────────────────

interface TodayViewProps {
  firstName?: string | null
}

export function TodayView({ firstName }: TodayViewProps) {
  // ── Today snapshot state ──────────────────────────────────────────────
  const [snapshot, setSnapshot] = useState<TodayApiResponse | null>(null)
  const [snapLoading, setSnapLoading] = useState(true)
  const [snapError, setSnapError] = useState<string | null>(null)

  // ── Live feed state ───────────────────────────────────────────────────
  const [stream, setStream] = useState<StreamPost[]>([])
  const [streamLoading, setStreamLoading] = useState(true)

  // ── Poll snapshot every 30s ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchSnapshot() {
      if (snapshot === null) setSnapLoading(true)
      setSnapError(null)
      try {
        const res = await fetch('/api/dashboard/today')
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data: TodayApiResponse = await res.json()
        if (!cancelled) {
          setSnapshot(data)
          setSnapLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setSnapError(err instanceof Error ? err.message : 'Something went wrong.')
          setSnapLoading(false)
        }
      }
    }

    void fetchSnapshot()
    const interval = setInterval(() => void fetchSnapshot(), 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Initial live-feed load ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchFeed() {
      setStreamLoading(true)
      try {
        const res = await fetch('/api/live-feed?limit=7')
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data: LiveFeedResponse = await res.json()
        if (!cancelled) {
          setStream(mapTweetsToStream(data.tweets ?? []))
          setStreamLoading(false)
        }
      } catch {
        if (!cancelled) {
          setStream([])
          setStreamLoading(false)
        }
      }
    }

    void fetchFeed()

    return () => {
      cancelled = true
    }
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────
  const kpis = snapshot?.kpis ?? { mentions24h: 0, tokenCount: 0, netSentiment: 0, alertCount: 0 }
  const pulseSeries = snapshot?.pulse.series ?? []
  const spikes = mapApiSpikes(snapshot?.spikes ?? [])
  const alerts = mapApiAlertsToItems(snapshot?.alerts ?? [])
  const watchlistSymbols = snapshot?.watchlistSymbols ?? []
  const isNewUser = !snapLoading && watchlistSymbols.length === 0

  const headline = deriveHeadline(snapshot?.spikes ?? [], kpis.alertCount)

  // ── Loading state ──────────────────────────────────────────────────────
  if (snapLoading) {
    return (
      <div style={{ padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
        <Greeting firstName={firstName} headline="Loading your dashboard…" alertCount={0} />
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--fg-3)', padding: '20px 0' }}>Loading…</div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (snapError) {
    return (
      <div style={{ padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
        <Greeting firstName={firstName} headline="Could not load dashboard data." alertCount={0} />
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--neg)', padding: '20px 0' }}>{snapError}</div>
      </div>
    )
  }

  // ── New-user empty state ───────────────────────────────────────────────
  if (isNewUser) {
    return (
      <div style={{ padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
        <Greeting firstName={firstName} headline="Start by adding tokens to your watchlist." alertCount={0} />
        <NewUserState />
      </div>
    )
  }

  // ── Normal render ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
      <Greeting firstName={firstName} headline={headline} alertCount={kpis.alertCount} />
      <KPIStrip kpis={kpis} />
      <Pulse series={pulseSeries} topSpikes={spikes} />
      {spikes.length > 0 && <Spikes spikes={spikes} />}
      {/* Phase 2: SentimentGrid */}
      {/* Phase 3: Narratives */}
      {/* Phase 4: Brief (HUM) */}
      <div style={{ display: 'grid', gridTemplateColumns: alerts.length > 0 ? '1.4fr 1fr' : '1fr', gap: 16 }}>
        <Stream stream={stream} loading={streamLoading} />
        {alerts.length > 0 && <AlertsLog alerts={alerts} />}
      </div>
    </div>
  )
}
