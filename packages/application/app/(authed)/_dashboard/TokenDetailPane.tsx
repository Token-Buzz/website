'use client'

import { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Avatar, Delta, fmtCount, fmtPrice } from './primitives'
import type { Token, Mention } from './types'

const SAMPLE_MENTIONS: Mention[] = [
  { handle: '@cobie',       followers: '812k', time: '4m',  sent: 'bull', text: 'watching $PEPE accumulate again. four wallets I tagged in march are buying. not advice, just pattern.' },
  { handle: '@hsaka',       followers: '210k', time: '12m', sent: 'bull', text: '$PEPE volume on coinbase pro is the cleanest it\'s been since may. someone\'s loading.' },
  { handle: '@CryptoKaleo', followers: '1.2M', time: '27m', sent: 'neu',  text: 'memecoin rotation feels stalled. $PEPE getting all the mindshare but the others are quiet.' },
  { handle: '@gainzy222',   followers: '98k',  time: '1h',  sent: 'bull', text: 'i still think $PEPE 2x from here before the cycle ends' },
  { handle: '@aeyakovenko', followers: '440k', time: '2h',  sent: 'neu',  text: 'fees on solana for $PEPE wrappers spiking again. interesting.' },
  { handle: '@degenspartan',followers: '320k', time: '3h',  sent: 'bear', text: 'every degen is long $PEPE rn. someone has to be wrong.' },
]

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

// ── Price Chart ────────────────────────────────────────────────────────────

function PriceChart({ token }: { token: Token }) {
  const pts = token.spark.flatMap((v, i, arr) => {
    if (i === arr.length - 1) return [v]
    return [v, (v + arr[i + 1]) / 2]
  })
  const w = 700, h = 200
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const xs = pts.length - 1
  const path = pts.map((p, i) => {
    const x = (i / xs) * w
    const y = h - ((p - min) / range) * (h - 20) - 10
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const fillPath = `${path} L${w},${h} L0,${h} Z`
  const lineColor = token.d24 >= 0 ? '#7BC47F' : '#E0664E'
  return (
    <div style={{ background: 'var(--data-bg)', borderRadius: 10, padding: 16, color: 'var(--data-fg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Eyebrow style={{ color: '#A39378' }}>Price · 24h · UTC</Eyebrow>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          {['1H','4H','24H','7D','30D'].map((w, i) => (
            <span key={w} style={{ font: '600 11px var(--font-mono)', padding: '3px 8px', borderRadius: 4, background: i === 2 ? 'rgba(255,179,71,0.15)' : 'transparent', color: i === 2 ? '#FFB347' : '#A39378', cursor: 'pointer' }}>{w}</span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={200} preserveAspectRatio="none">
        <defs>
          <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#2A2620" strokeWidth="1" strokeDasharray="2,4" />
        ))}
        <path d={fillPath} fill="url(#cf)" />
        <path d={path} stroke={lineColor} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Mention Card ───────────────────────────────────────────────────────────

function MentionCard({ m }: { m: Mention }) {
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

// ── Token Detail Pane ──────────────────────────────────────────────────────

interface TokenDetailPaneProps {
  token: Token
  onClose: () => void
  onAskHum?: (question: string) => void
  mentions?: Mention[]
}

export function TokenDetailPane({ token, onClose, onAskHum, mentions = SAMPLE_MENTIONS }: TokenDetailPaneProps) {
  const score = token.sent === 'bull' ? 62 : token.sent === 'bear' ? -48 : 8
  const scoreColor = score > 20 ? 'var(--pos)' : score < -20 ? 'var(--neg)' : 'var(--neu)'

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
        <Button variant="ghost" size="sm" icon="bell">Set alert</Button>
        <Button variant="primary" size="sm" icon="sparkle" onClick={() => onAskHum?.(`What's driving $${token.sym} buzz?`)}>Ask Hum</Button>
        <Button variant="quiet" size="sm" icon="close" onClick={onClose} />
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[
          { l: 'Price',          v: '—',                     s: <Delta value={token.d24} style={{ fontSize: 13 }} /> },
          { l: 'Mentions / 24h', v: fmtCount(token.mentions), s: <Delta value={token.dbuzz} style={{ fontSize: 13 }} /> },
          { l: 'Unique handles', v: '412',                   s: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>+38 new</span> },
          { l: 'Sentiment',      v: <span style={{ color: scoreColor }}>{score > 0 ? '+' : ''}{score}</span>, s: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>of 100</span> },
        ].map((c, i) => (
          <div key={i} style={{ padding: '14px 20px', borderRight: i < 3 ? '1px solid var(--border-hairline)' : 'none' }}>
            <Eyebrow style={{ marginBottom: 6 }}>{c.l}</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ font: '600 22px var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{c.v}</span>
              {c.s}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + sentiment dial */}
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, flexShrink: 0 }}>
        <PriceChart token={token} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Eyebrow>Sentiment dial</Eyebrow>
          <SentimentMeter score={score} width={200} />
          <div style={{ textAlign: 'center', font: '600 18px var(--font-mono)', color: scoreColor }}>
            {score > 20 ? '▲ Bullish' : score < -20 ? '▼ Bearish' : '◆ Mixed'} · {score > 0 ? '+' : ''}{score}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>
            <span>bear</span><span>mixed</span><span>bull</span>
          </div>
        </div>
      </div>

      {/* Mentions */}
      <div style={{ padding: '0 20px 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 14px' }}>
          <Eyebrow>Live mentions · sorted by reach</Eyebrow>
          <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>updated 12s ago</span>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {mentions.map((m, i) => <MentionCard key={i} m={m} />)}
        </div>
      </div>
    </div>
  )
}
