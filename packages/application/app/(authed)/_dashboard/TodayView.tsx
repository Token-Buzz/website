'use client'

import {
  Icon, Button, Eyebrow, Ticker, BuzzDot, Sparkline, Delta, Avatar,
  Card, SectionHead, fmtCount,
} from './primitives'
import type { DashboardData } from './types'

// ── Sample data (used until API is seeded) ─────────────────────────────────

const SAMPLE: DashboardData = {
  mentions24h: '2.14M',
  mentionsDelta: 18.4,
  tokenCount: 49,
  alertCount: 14,
  alertDelta: 6,
  netSentiment: 12,
  sentimentDelta: 9.2,
  pulseSeries: [
    84, 86, 88, 85, 90, 92, 88, 94, 99, 102, 106, 110, 118, 122, 130,
    142, 156, 168, 174, 182, 190, 188, 192, 198, 204, 212, 218, 224, 226, 232,
    238, 244, 250, 256, 252, 248, 244, 252, 264, 272, 280, 288, 298, 304, 312,
    308, 314, 322, 328, 336, 342, 348, 354, 358, 362, 366, 370, 376, 382, 388,
  ],
  spikes: [
    { sym: 'MOG',   name: 'Mog Coin',  dbuzz: 4180, mentions: 6700,  sent: 'bull', spark: [3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true,  summary: 'Three previously dormant whales retweeted into MOG within 14 minutes.' },
    { sym: 'PEPE',  name: 'Pepe',      dbuzz: 412,  mentions: 48900, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true,  summary: 'Accumulation talk from six mid-tier handles. Coinbase Pro volume cleanest since May.' },
    { sym: 'TURBO', name: 'Turbo',     dbuzz: 96,   mentions: 3100,  sent: 'bull', spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true, summary: 'Discord chatter spike from three trader cohorts. Quiet on X — yet.' },
    { sym: 'WIF',   name: 'dogwifhat', dbuzz: 84,   mentions: 9800,  sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16], live: false, summary: 'Steady climb. No single catalyst — just broad-based mention growth.' },
  ],
  sentimentTokens: [
    { sym: 'PEPE',  mentions: 48900, score:  62, d: +18 },
    { sym: 'SOL',   mentions: 12400, score: -42, d:  -8 },
    { sym: 'BONK',  mentions: 22700, score:   4, d:  -2 },
    { sym: 'WIF',   mentions:  9800, score:  48, d: +12 },
    { sym: 'DOGE',  mentions: 18900, score:   8, d:  +1 },
    { sym: 'MOG',   mentions:  6700, score:  78, d: +44 },
    { sym: 'TURBO', mentions:  3100, score:  56, d: +22 },
    { sym: 'BRETT', mentions:  4400, score:  -8, d:  -6 },
    { sym: 'ETH',   mentions: 31200, score:  12, d:  +4 },
    { sym: 'JUP',   mentions:  7800, score: -22, d: -10 },
    { sym: 'TIA',   mentions:  5200, score: -36, d: -18 },
    { sym: 'ARB',   mentions:  6100, score:  -4, d:  -3 },
  ],
  narratives: [
    { title: 'AI agents are back',        mentions: 4820, growth: 312, tokens: ['FET','AGIX','TAO','VIRTUAL'], handles: 42, summary: 'Three macro accounts pivoted to AI agent talk after the Anthropic release. Token chatter following.' },
    { title: 'L2 fees discourse round 9', mentions: 3140, growth: 86,  tokens: ['ARB','OP','BASE'], handles: 28, summary: 'Sentiment turning bearish on L2s. Watch for capital rotation back to L1.' },
    { title: 'Memecoin rotation stalling', mentions: 8900, growth: -22, tokens: ['PEPE','WIF','BONK'], handles: 64, summary: 'Big handles quiet. Only PEPE and MOG actively accumulating mindshare.' },
    { title: 'Restaking exhaustion',      mentions: 2240, growth: -14, tokens: ['EIGEN','ETHFI'], handles: 19, summary: 'Narrative cooling. Mentions down across the cohort. May be opportunity if you\'re contrarian.' },
  ],
  stream: [
    { handle: '@cobie',       followers: '812k', time:  '2m', sent: 'bull', text: 'watching $PEPE accumulate again. four wallets I tagged in march are buying. not advice, just pattern.', tick: 'PEPE' },
    { handle: '@hsaka',       followers: '210k', time:  '4m', sent: 'bull', text: '$MOG volume profile is the cleanest setup I\'ve seen since the last cycle. fwiw.', tick: 'MOG' },
    { handle: '@aeyakovenko', followers: '440k', time:  '9m', sent: 'neu',  text: 'fees on solana for memecoin wrappers spiking again. interesting.', tick: 'SOL' },
    { handle: '@CryptoKaleo', followers: '1.2M', time: '11m', sent: 'neu',  text: 'memecoin rotation feels stalled. $PEPE getting all the mindshare but the others are quiet.', tick: 'PEPE' },
    { handle: '@degenspartan',followers: '320k', time: '16m', sent: 'bear', text: 'every degen is long $PEPE rn. someone has to be wrong.', tick: 'PEPE' },
    { handle: '@hosseeb',     followers: '168k', time: '22m', sent: 'bull', text: '$MOG is one of those names where the buyers are louder than the chart suggests.', tick: 'MOG' },
    { handle: '@gainzy222',   followers:  '98k', time: '28m', sent: 'bull', text: 'i still think $PEPE 2x from here before the cycle ends', tick: 'PEPE' },
  ],
  alerts: [
    { tone: 'buzz',      time: '08:42', tag: 'BUZZ SPIKE',      target: '$MOG',      body: 'Mentions /min jumped from 14 to 218 in the last 30m. Crossed your 10× rule.' },
    { tone: 'sent',      time: '08:18', tag: 'SENTIMENT FLIP',  target: '$SOL',      body: 'Sentiment crossed −40 for the first time in 12 days.' },
    { tone: 'handle',    time: '07:51', tag: 'WHALE HANDLE',    target: '@cobie',    body: 'Just posted about $PEPE — first time in 31 days.' },
    { tone: 'narrative', time: '07:14', tag: 'NEW NARRATIVE',   target: 'AI agents', body: 'Cluster of 12 handles started co-mentioning $FET / $AGIX / $VIRTUAL inside 90 minutes.' },
  ],
}

// ── Greeting ───────────────────────────────────────────────────────────────

function Greeting({ firstName }: { firstName?: string | null }) {
  const now = new Date()
  const utc = now.toUTCString().replace('GMT', 'UTC').split(' ').slice(0, 5).join(' ')
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 4 }}>
      <div style={{ flex: 1 }}>
        <Eyebrow style={{ marginBottom: 6 }}>Today · {utc}</Eyebrow>
        <div style={{ font: '600 28px/1.15 var(--font-sans)', letterSpacing: '-0.015em' }}>
          {firstName ? `Morning, ${firstName}.` : 'Morning.'}{' '}
          <span style={{ color: 'var(--fg-3)' }}>
            Loud open — $MOG is up 42× on mentions and three of your bear-watch tokens flipped overnight.
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button variant="ghost" size="md" icon="bell">4 new alerts</Button>
        <Button variant="primary" size="md" icon="sparkle">Brief me</Button>
      </div>
    </div>
  )
}

// ── KPI Strip ──────────────────────────────────────────────────────────────

function KPI({ label, value, delta, deltaFmt = 'pct', foot, accent }: {
  label: string; value: string | number; delta?: number; deltaFmt?: 'pct' | 'raw'; foot?: string; accent?: string
}) {
  return (
    <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          font: '600 28px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em', color: accent || 'var(--fg-1)',
        }}>{value}</span>
        {delta != null && <Delta value={delta} format={deltaFmt} style={{ fontSize: 13 }} />}
      </div>
      {foot && <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{foot}</div>}
    </Card>
  )
}

function KPIStrip({ data }: { data: DashboardData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <KPI label="Mentions · 24h" value={data.mentions24h} delta={data.mentionsDelta} foot="across 24 watchlist tokens" />
      <KPI label="Tokens tracked" value={data.tokenCount} foot="6 watchlists · 412 handles" />
      <KPI label="Alerts fired" value={data.alertCount} delta={data.alertDelta} deltaFmt="raw" foot="3 unread · 11 acknowledged" accent="var(--accent)" />
      <KPI label="Net sentiment" value={`+${data.netSentiment}`} delta={data.sentimentDelta} foot="bull bias · widening since 06:00 UTC" accent="var(--pos)" />
    </div>
  )
}

// ── Pulse ──────────────────────────────────────────────────────────────────

function PulseChart({ points, color = 'var(--data-pos)', height = 120 }: { points: number[]; color?: string; height?: number }) {
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

function SentimentSplit({ bull, neu, bear }: { bull: number; neu: number; bear: number }) {
  const total = bull + neu + bear
  const seg = (v: number, c: string) => (
    <div style={{
      width: `${(v / total) * 100}%`, background: c, height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '600 10px var(--font-mono)', color: 'rgba(11,11,12,0.7)',
      letterSpacing: '0.05em',
    }}>{((v / total) * 100).toFixed(0)}%</div>
  )
  return (
    <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--data-line)' }}>
      {seg(bull, 'var(--data-pos)')}
      {seg(neu, 'var(--data-amber)')}
      {seg(bear, 'var(--data-neg)')}
    </div>
  )
}

function Pulse({ series }: { series: number[] }) {
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
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)' }}>rolling 60min · 412 handles · all watchlists</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {['15m','1H','4H','24H'].map((w, i) => (
            <span key={w} style={{
              font: '600 11px var(--font-mono)', padding: '4px 9px', borderRadius: 4,
              background: i === 1 ? 'rgba(255,179,71,0.14)' : 'transparent',
              color: i === 1 ? 'var(--data-amber)' : 'var(--data-dim)',
              cursor: 'pointer',
            }}>{w}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-dim)', marginBottom: 6 }}>Mentions / min</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ font: '600 56px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: 'var(--data-fg)' }}>2,140</span>
              <span style={{ font: '600 14px var(--font-mono)', color: 'var(--data-pos)' }}>+412%</span>
            </div>
            <div style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)', marginTop: 4 }}>vs 60min avg · 418/min</div>
          </div>
          <div>
            <div style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-dim)', marginBottom: 8 }}>Sentiment split</div>
            <SentimentSplit bull={62} neu={20} bear={18} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 10px var(--font-mono)', color: 'var(--data-dim)' }}>
              <span>bull</span><span>mixed</span><span>bear</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <PulseChart points={series} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 10px var(--font-mono)', color: 'var(--data-dim)' }}>
            <span>−60m</span><span>−45m</span><span>−30m</span><span>−15m</span><span>now</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(255,179,71,0.06)', border: '1px solid rgba(255,179,71,0.2)', borderRadius: 6 }}>
            <span style={{ font: '600 10px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--data-amber)' }}>Loudest right now</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Ticker symbol="MOG" variant="dark" />
              <Ticker symbol="PEPE" variant="dark" />
              <Ticker symbol="ETH" variant="dark" />
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)' }}>74% of all mentions in last 5min</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Spikes ─────────────────────────────────────────────────────────────────

function SpikeCard({ t }: { t: DashboardData['spikes'][0] }) {
  return (
    <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ticker symbol={t.sym} />
        <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-3)' }}>{t.name}</span>
        <div style={{ flex: 1 }} />
        {t.live && <BuzzDot />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: '600 24px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>+{t.dbuzz}%</span>
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>buzz · 1H</span>
      </div>
      <Sparkline points={t.spark} color="var(--pos)" width={260} height={36} fill />
      <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)', flex: 1 }}>{t.summary}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-hairline)', font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>
        <span>{fmtCount(t.mentions)} mentions</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>Open <Icon name="chevR" size={11} /></span>
      </div>
    </Card>
  )
}

function Spikes({ spikes }: { spikes: DashboardData['spikes'] }) {
  return (
    <section>
      <SectionHead eyebrow="Biggest spikes · last hour" meta="ranked by mention rate Δ" action={<Button variant="quiet" size="sm">See all movers →</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {spikes.map((t) => <SpikeCard key={t.sym} t={t} />)}
      </div>
    </section>
  )
}

// ── Brief ──────────────────────────────────────────────────────────────────

function Brief() {
  return (
    <Card padding={20} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 240px', gap: 24, alignItems: 'flex-start' }}>
      <div style={{
        background: 'var(--inv-bg)', color: 'var(--inv-fg)',
        fontFamily: 'var(--font-display)', fontSize: 22,
        padding: '10px 12px 7px', lineHeight: 1, alignSelf: 'stretch',
        display: 'flex', alignItems: 'center',
      }}>HUM.</div>
      <div style={{ minWidth: 0 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Morning brief · 09:00 UTC</Eyebrow>
        <div style={{ font: '500 16px/1.5 var(--font-sans)', letterSpacing: '-0.005em', color: 'var(--fg-1)' }}>
          <span style={{ color: 'var(--fg-2)' }}>Three things I'd watch tonight.</span>{' '}
          $MOG just broke its 30-day mention high — four whale handles I tagged in March came back.{' '}
          $PEPE accumulation chatter is the loudest since May, but @degenspartan is loudly bearish.{' '}
          And the AI-agent narrative is back: $FET / $AGIX / $VIRTUAL co-mentions clustered inside a 90-minute window.{' '}
          <span style={{ color: 'var(--fg-3)' }}>I'd front-run that one.</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {['@cobie','@hsaka','@hosseeb','@gainzy222','@CryptoKaleo','+ 38 more'].map((s) => (
            <span key={s} style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)', background: 'var(--bg-sunken)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 999 }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--border-hairline)', paddingLeft: 20, alignSelf: 'stretch' }}>
        <Eyebrow>Quick asks</Eyebrow>
        {["What's driving $MOG?", 'Is the $PEPE bearish thread credible?', 'Cluster the AI-agent handles.'].map((q) => (
          <button key={q} style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg-2)', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', font: '500 12px/1.4 var(--font-sans)' }}>{q}</button>
        ))}
      </div>
    </Card>
  )
}

// ── Sentiment Grid ─────────────────────────────────────────────────────────

function SentCell({ t }: { t: DashboardData['sentimentTokens'][0] }) {
  const intensity = Math.min(1, Math.abs(t.score) / 80)
  let bg: string, fg: string
  if (t.score > 5) {
    bg = `color-mix(in oklch, var(--data-pos) ${intensity * 50}%, transparent)`
    fg = 'var(--pos)'
  } else if (t.score < -5) {
    bg = `color-mix(in oklch, var(--data-neg) ${intensity * 50}%, transparent)`
    fg = 'var(--neg)'
  } else {
    bg = 'var(--bg-sunken)'
    fg = 'var(--neu)'
  }
  return (
    <div style={{ background: bg, border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ticker symbol={t.sym} size="sm" />
        <Delta value={t.d} style={{ fontSize: 11 }} />
      </div>
      <div style={{ font: '600 18px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: fg }}>
        {t.score > 0 ? '+' : ''}{t.score}
      </div>
      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{fmtCount(t.mentions)} mentions</div>
    </div>
  )
}

function SentimentGrid({ tokens }: { tokens: DashboardData['sentimentTokens'] }) {
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHead
        eyebrow="Sentiment grid"
        meta="all watchlists · 24h · score −100…+100"
        action={
          <div style={{ display: 'inline-flex', gap: 12, font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--data-pos)', marginRight: 4, opacity: 0.5 }} />bull</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--data-amber)', marginRight: 4, opacity: 0.5 }} />mixed</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--data-neg)', marginRight: 4, opacity: 0.5 }} />bear</span>
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {tokens.map((t) => <SentCell key={t.sym} t={t} />)}
      </div>
    </Card>
  )
}

// ── Narratives ─────────────────────────────────────────────────────────────

function NarrativeRow({ n, isLast }: { n: DashboardData['narratives'][0]; isLast: boolean }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ font: '600 14px var(--font-sans)', letterSpacing: '-0.01em', flex: 1, minWidth: 0 }}>{n.title}</span>
        <Delta value={n.growth} style={{ fontSize: 12 }} />
      </div>
      <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-2)' }}>{n.summary}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {n.tokens.map((s) => <Ticker key={s} symbol={s} size="sm" />)}
        <div style={{ flex: 1 }} />
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>{fmtCount(n.mentions)} · {n.handles} handles</span>
      </div>
    </div>
  )
}

function Narratives({ narratives }: { narratives: DashboardData['narratives'] }) {
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead eyebrow="Emerging narratives" meta="Hum clustered · last 12h" action={<Button variant="quiet" size="sm">All narratives →</Button>} />
      <div>
        {narratives.map((n, i) => <NarrativeRow key={n.title} n={n} isLast={i === narratives.length - 1} />)}
      </div>
    </Card>
  )
}

// ── Stream ─────────────────────────────────────────────────────────────────

function StreamItem({ m, isLast }: { m: DashboardData['stream'][0]; isLast: boolean }) {
  const sentColor = m.sent === 'bull' ? 'var(--pos)' : m.sent === 'bear' ? 'var(--neg)' : 'var(--neu)'
  const sentGlyph = m.sent === 'bull' ? '▲' : m.sent === 'bear' ? '▼' : '◆'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, padding: '10px 0', alignItems: 'flex-start', borderBottom: isLast ? 'none' : '1px solid var(--border-hairline)' }}>
      <Avatar name={m.handle.replace('@', '')} size={26} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ font: '600 12px var(--font-sans)' }}>{m.handle}</span>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{m.followers}</span>
          <span style={{ color: 'var(--fg-4)' }}>·</span>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--fg-3)' }}>{m.time}</span>
          <Ticker symbol={m.tick} size="sm" />
        </div>
        <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg-1)' }}>{m.text}</div>
      </div>
      <span style={{ color: sentColor, font: '600 12px var(--font-mono)', paddingTop: 4 }}>{sentGlyph}</span>
    </div>
  )
}

function Stream({ stream }: { stream: DashboardData['stream'] }) {
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead
        eyebrow="Live stream · high signal"
        meta="filtered to >50k followers · your watchlist tickers"
        action={<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BuzzDot /><span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>updated 4s ago</span></div>}
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

function AlertRow({ a, isLast }: { a: DashboardData['alerts'][0]; isLast: boolean }) {
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

function AlertsLog({ alerts }: { alerts: DashboardData['alerts'] }) {
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead eyebrow="Alerts fired today" meta={`${alerts.length} unread`} action={<Button variant="quiet" size="sm">Rules →</Button>} />
      <div>
        {alerts.map((a, i) => <AlertRow key={i} a={a} isLast={i === alerts.length - 1} />)}
      </div>
    </Card>
  )
}

// ── TodayView ──────────────────────────────────────────────────────────────

interface TodayViewProps {
  firstName?: string | null
  data?: DashboardData
}

export function TodayView({ firstName, data = SAMPLE }: TodayViewProps) {
  return (
    <div style={{ padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
      <Greeting firstName={firstName} />
      <KPIStrip data={data} />
      <Pulse series={data.pulseSeries} />
      <Spikes spikes={data.spikes} />
      <Brief />
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }}>
        <SentimentGrid tokens={data.sentimentTokens} />
        <Narratives narratives={data.narratives} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Stream stream={data.stream} />
        <AlertsLog alerts={data.alerts} />
      </div>
      <div style={{ textAlign: 'center', paddingTop: 16, font: '500 11px var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
        TokenBuzz · social intelligence, tuned to the human ear · v0.1.0
      </div>
    </div>
  )
}
