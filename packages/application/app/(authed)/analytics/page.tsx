'use client'

import { useState } from 'react'
import { Card, SectionHead, Eyebrow, Button, Delta, Ticker, fmtCount } from '../_dashboard/primitives'

// ── Sample analytics data ──────────────────────────────────────────────────

const HASHTAGS = [
  { tag: '#pepe',   count: 18420, pct: 100 },
  { tag: '#mog',    count: 12840,  pct: 69  },
  { tag: '#solana', count: 9140,   pct: 50  },
  { tag: '#crypto', count: 8720,   pct: 47  },
  { tag: '#bonk',   count: 7600,   pct: 41  },
  { tag: '#ai',     count: 6480,   pct: 35  },
  { tag: '#defi',   count: 5240,   pct: 28  },
  { tag: '#wif',    count: 4820,   pct: 26  },
  { tag: '#eth',    count: 4200,   pct: 23  },
  { tag: '#turbo',  count: 3640,   pct: 20  },
]

const TOP_HANDLES = [
  { handle: '@cobie',        followers: '812k', mentions: 48, engagement: 9.2 },
  { handle: '@hsaka',        followers: '210k', mentions: 31, engagement: 7.4 },
  { handle: '@CryptoKaleo',  followers: '1.2M', mentions: 28, engagement: 11.3 },
  { handle: '@aeyakovenko',  followers: '440k', mentions: 22, engagement: 6.8 },
  { handle: '@degenspartan', followers: '320k', mentions: 19, engagement: 8.1 },
  { handle: '@hosseeb',      followers: '168k', mentions: 16, engagement: 5.9 },
  { handle: '@gainzy222',    followers:  '98k', mentions: 14, engagement: 12.4 },
]

const SENTIMENT_HOURS = [
  { hour: '00', bull: 58, neu: 22, bear: 20 },
  { hour: '02', bull: 55, neu: 24, bear: 21 },
  { hour: '04', bull: 52, neu: 26, bear: 22 },
  { hour: '06', bull: 57, neu: 23, bear: 20 },
  { hour: '08', bull: 63, neu: 20, bear: 17 },
  { hour: '10', bull: 68, neu: 18, bear: 14 },
  { hour: '12', bull: 65, neu: 19, bear: 16 },
  { hour: '14', bull: 61, neu: 21, bear: 18 },
  { hour: '16', bull: 66, neu: 19, bear: 15 },
  { hour: '18', bull: 70, neu: 17, bear: 13 },
  { hour: '20', bull: 67, neu: 18, bear: 15 },
  { hour: '22', bull: 62, neu: 20, bear: 18 },
]

// ── Hashtag leaderboard ────────────────────────────────────────────────────

function HashtagLeaderboard() {
  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHead eyebrow="Top hashtags" meta="last 24h" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {HASHTAGS.map((h, i) => (
          <div key={h.tag} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-4)', width: 16, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ font: '600 13px var(--font-mono)', color: 'var(--fg-2)', width: 100, flexShrink: 0 }}>{h.tag}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${h.pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, opacity: 0.7 }} />
            </div>
            <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-1)', width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCount(h.count)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Top handles ────────────────────────────────────────────────────────────

function TopHandles() {
  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHead eyebrow="Top mentioned handles" meta="last 24h · by reach" />
      <div>
        {TOP_HANDLES.map((h, i) => (
          <div key={h.handle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < TOP_HANDLES.length - 1 ? '1px solid var(--border-hairline)' : 'none' }}>
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-4)', width: 16, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ font: '600 13px var(--font-sans)', color: 'var(--fg-1)', flex: 1 }}>{h.handle}</span>
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', width: 48 }}>{h.followers}</span>
            <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-2)', width: 40, textAlign: 'right' }}>{h.mentions}</span>
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', width: 32, textAlign: 'right' }}>{h.engagement}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Sentiment over time chart ──────────────────────────────────────────────

function SentimentTimeline() {
  const w = 800, h = 160
  const maxBull = Math.max(...SENTIMENT_HOURS.map((d) => d.bull))

  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHead eyebrow="Sentiment over time" meta="last 24h · % bull / bear / mixed" />
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
          {SENTIMENT_HOURS.map((d, i) => {
            const x = (i / (SENTIMENT_HOURS.length - 1)) * w
            const bullH = (d.bull / 100) * h
            const bearH = (d.bear / 100) * h
            const barW = w / SENTIMENT_HOURS.length - 4
            return (
              <g key={d.hour} transform={`translate(${x - barW / 2}, 0)`}>
                <rect x={0} y={h - bullH} width={barW} height={bullH} fill="var(--pos)" opacity="0.6" rx="2" />
                <rect x={0} y={h - bullH - bearH} width={barW} height={bearH} fill="var(--neg)" opacity="0.5" rx="2" />
              </g>
            )
          })}
          {[25, 50, 75].map((pct) => (
            <line key={pct} x1={0} x2={w} y1={h - (pct / 100) * h} y2={h - (pct / 100) * h} stroke="var(--border)" strokeWidth="1" strokeDasharray="2,4" />
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 10px var(--font-mono)', color: 'var(--fg-4)' }}>
          {SENTIMENT_HOURS.map((d) => <span key={d.hour}>{d.hour}h</span>)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, font: '500 11px var(--font-mono)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--pos)', borderRadius: 2, marginRight: 6, opacity: 0.6 }} />Bull avg {Math.round(SENTIMENT_HOURS.reduce((a, b) => a + b.bull, 0) / SENTIMENT_HOURS.length)}%</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--neg)', borderRadius: 2, marginRight: 6, opacity: 0.5 }} />Bear avg {Math.round(SENTIMENT_HOURS.reduce((a, b) => a + b.bear, 0) / SENTIMENT_HOURS.length)}%</span>
        </div>
      </div>
    </Card>
  )
}

// ── Analytics page ─────────────────────────────────────────────────────────

const TIME_WINDOWS = ['1H', '4H', '24H', '7D'] as const

export default function AnalyticsPage() {
  const [window, setWindow] = useState<'1H' | '4H' | '24H' | '7D'>('24H')

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Analytics</Eyebrow>
          <h1 style={{ font: '600 28px/1.15 var(--font-sans)', letterSpacing: '-0.015em', color: 'var(--fg-1)', margin: 0 }}>Social analytics</h1>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, gap: 2 }}>
          {TIME_WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                border: 'none', padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                font: '600 11px var(--font-sans)',
                background: window === w ? 'var(--bg-elevated)' : 'transparent',
                color: window === w ? 'var(--fg-1)' : 'var(--fg-2)',
              }}
            >{w}</button>
          ))}
        </div>
      </div>

      <SentimentTimeline />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <HashtagLeaderboard />
        <TopHandles />
      </div>

      <div style={{ textAlign: 'center', font: '500 11px var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
        Analytics data refreshes every 5 minutes · powered by TokenBuzz social intelligence
      </div>
    </div>
  )
}
