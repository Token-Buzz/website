'use client'

import { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Avatar, Delta, fmtCount, fmtPrice } from './primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Token, Mention } from './types'
import { CandleChart } from './CandleChart'
import { fromChart } from './humContext'

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
  onClose?: () => void
  onAskHum?: (question: string) => void
  mentions?: Mention[]
}

export function TokenDetailPane({ token, onClose, onAskHum, mentions = SAMPLE_MENTIONS }: TokenDetailPaneProps) {
  const score = token.sent === 'bull' ? 62 : token.sent === 'bear' ? -48 : 8
  const scoreColor = score > 20 ? 'var(--pos)' : score < -20 ? 'var(--neg)' : 'var(--neu)'
  const isMobile = useIsMobile()

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
        {/* On mobile, show icon-only to avoid crowding the 390px header row */}
        <Button variant="ghost" size="sm" icon="bell">{isMobile ? null : 'Set alert'}</Button>
        <Button variant="primary" size="sm" icon="sparkle" onClick={() => {
          const ctx = fromChart({ symbol: token.sym, interval: '1h' })
          window.dispatchEvent(new CustomEvent('hum:add-context', { detail: ctx }))
          onAskHum?.(`What's driving $${token.sym} buzz?`)
        }}>{isMobile ? null : 'Ask Hum'}</Button>
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
          { l: 'Price',          v: '—',                     s: <Delta value={token.d24} style={{ fontSize: 13 }} /> },
          { l: 'Mentions / 24h', v: fmtCount(token.mentions), s: <Delta value={token.dbuzz} style={{ fontSize: 13 }} /> },
          { l: 'Unique handles', v: '412',                   s: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>+38 new</span> },
          { l: 'Sentiment',      v: <span style={{ color: scoreColor }}>{score > 0 ? '+' : ''}{score}</span>, s: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>of 100</span> },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              padding: isMobile ? '12px 14px' : '14px 20px',
              minWidth: 0,
              // Desktop (4-col): right-border on first 3 cells
              // Mobile (2-col): right-border on left-column cells (i%2===0),
              //                 bottom-border on top row (i<2)
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

      {/* Chart + sentiment dial — side-by-side on desktop, stacked on mobile */}
      <div style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 240px',
        gap: 16,
        flexShrink: 0,
      }}>
        <CandleChart symbol={token.sym} height={260} />
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
          <SentimentMeter score={score} width={200} />
          <div style={{ textAlign: 'center', font: '600 18px var(--font-mono)', color: scoreColor }}>
            {score > 20 ? '▲ Bullish' : score < -20 ? '▼ Bearish' : '◆ Mixed'} · {score > 0 ? '+' : ''}{score}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11px var(--font-mono)', color: 'var(--fg-3)', width: 200 }}>
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
