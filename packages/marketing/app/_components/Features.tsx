import React from 'react'
import Icon, { type IconName } from './Icon'

// ── In-card data visualizations ──────────────────────────────────────────────

function VizTracking() {
  const rows = [
    { k: '$PEPE', v: '+412%', c: 'var(--data-pos)', w: '98%' },
    { k: '$WIF',  v: '+84%',  c: 'var(--data-pos)', w: '62%' },
    { k: '$BONK', v: '+7%',   c: 'var(--data-amber)', w: '22%' },
    { k: '$SOL',  v: '−18%',  c: 'var(--data-neg)', w: '18%' },
  ]
  return (
    <div
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        borderRadius: 10,
        padding: '14px 14px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        border: '1px solid var(--data-line)',
      }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr 56px',
            gap: 8,
            alignItems: 'center',
            padding: '5px 0',
          }}
        >
          <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>{r.k}</span>
          <div
            style={{
              background: 'var(--data-line)',
              height: 5,
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div style={{ width: r.w, height: '100%', background: r.c, borderRadius: 4 }} />
          </div>
          <span style={{ color: r.c, fontWeight: 600, textAlign: 'right' }}>{r.v}</span>
        </div>
      ))}
    </div>
  )
}

function VizSentiment() {
  return (
    <div
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        borderRadius: 10,
        padding: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        border: '1px solid var(--data-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
          color: 'var(--data-dim)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span>Sentiment · 24h</span>
        <span>$PEPE</span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <div style={{ width: '62%', background: 'var(--data-pos)' }} />
        <div style={{ width: '26%', background: 'var(--data-amber)' }} />
        <div style={{ width: '12%', background: 'var(--data-neg)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
        <div><span style={{ color: 'var(--data-pos)' }}>● </span><span style={{ color: 'var(--data-dim)' }}>bull</span> <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>62%</span></div>
        <div><span style={{ color: 'var(--data-amber)' }}>● </span><span style={{ color: 'var(--data-dim)' }}>neu</span> <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>26%</span></div>
        <div><span style={{ color: 'var(--data-neg)' }}>● </span><span style={{ color: 'var(--data-dim)' }}>bear</span> <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>12%</span></div>
      </div>
    </div>
  )
}

function VizWatchlist() {
  const rows = [
    { k: '$MOG',   p: '$0.0000018', d: '+41.2%', c: 'var(--data-pos)', spark: 'M0 18 L8 16 L16 14 L24 11 L32 5 L40 3' },
    { k: '$TURBO', p: '$0.0041',    d: '+8.07%', c: 'var(--data-pos)', spark: 'M0 14 L8 13 L16 11 L24 12 L32 9 L40 8' },
    { k: '$BRETT', p: '$0.092',     d: '−1.18%', c: 'var(--data-neg)', spark: 'M0 8 L8 9 L16 11 L24 10 L32 13 L40 14' },
  ]
  return (
    <div
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        border: '1px solid var(--data-line)',
      }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '52px 60px 1fr 50px',
            gap: 8,
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: i < 2 ? '1px solid var(--data-line)' : 'none',
          }}
        >
          <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>{r.k}</span>
          <span style={{ color: 'var(--data-dim)' }}>{r.p}</span>
          <svg viewBox="0 0 40 20" width="100%" height="16" preserveAspectRatio="none">
            <path d={r.spark} fill="none" stroke={r.c} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ color: r.c, fontWeight: 600, textAlign: 'right' }}>{r.d}</span>
        </div>
      ))}
    </div>
  )
}

function VizHum() {
  return (
    <div
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        borderRadius: 10,
        padding: '12px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.6,
        border: '1px solid var(--data-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          color: 'var(--data-dim)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        <span
          style={{
            background: 'var(--inv-bg)',
            color: 'var(--inv-fg)',
            padding: '2px 5px',
            borderRadius: 3,
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.04em',
          }}
        >
          HUM
        </span>
        <span>· 3 sources</span>
      </div>
      <div style={{ color: 'var(--data-fg)' }}>
        <span style={{ color: 'var(--data-amber)' }}>$MOG</span>
        {' '}buzz is up 218% but it&apos;s all one cluster — six new wallets, same handle network. I&apos;d watch but wouldn&apos;t chase yet.
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 12,
            background: 'var(--accent)',
            verticalAlign: 'middle',
            marginLeft: 2,
            animation: 'tb-cursor 1s steps(2) infinite',
          }}
        />
      </div>
    </div>
  )
}

// ── Feature card ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: IconName
  kicker: string
  title: string
  body: string
  accent?: boolean
  children?: React.ReactNode
}

function FeatureCard({ icon, kicker, title, body, accent, children }: FeatureCardProps) {
  return (
    <div
      className="feature-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: accent ? 'var(--buzz-500)' : 'var(--inv-bg)',
            color: accent ? '#fff' : 'var(--inv-fg)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={18} />
        </div>
        <span
          style={{
            font: '600 11px var(--font-mono)',
            color: 'var(--fg-3)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </span>
      </div>
      <div
        style={{
          font: '600 22px/1.2 var(--font-sans)',
          letterSpacing: '-0.012em',
          color: 'var(--fg-1)',
        }}
      >
        {title}
      </div>
      <div style={{ font: '400 14px/1.55 var(--font-sans)', color: 'var(--fg-2)' }}>
        {body}
      </div>
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function Features() {
  return (
    <section
      id="features"
      style={{ padding: '96px 32px 64px', maxWidth: 1280, margin: '0 auto' }}
    >
      <div
        className="features-header"
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, marginBottom: 48 }}
      >
        <div>
          <div
            style={{
              font: '600 12px/1.2 var(--font-sans)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--fg-2)',
              marginBottom: 16,
            }}
          >
            What you get
          </div>
          <h2
            style={{
              font: '600 40px/1.05 var(--font-sans)',
              letterSpacing: '-0.018em',
              color: 'var(--fg-1)',
              margin: 0,
            }}
          >
            Bloomberg precision.<br />Without the Bloomberg.
          </h2>
        </div>
        <div
          style={{
            font: '400 17px/1.55 var(--font-sans)',
            color: 'var(--fg-2)',
            maxWidth: 520,
            alignSelf: 'end',
          }}
        >
          Every other crypto tool tells you the chart moved. We tell you who started talking
          about it twenty minutes earlier — and whether they&apos;ve ever been right.
        </div>
      </div>

      <div
        className="features-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
      >
        <FeatureCard
          icon="pulse"
          kicker="01 · Real-time tracking"
          title="Track buzz on X, second by second."
          body="Mention counts, reach, and velocity for any token or keyword across 412k tracked X handles. Updated every 12 seconds — alerts fire the moment a curve breaks."
          accent
        >
          <VizTracking />
        </FeatureCard>

        <FeatureCard
          icon="chart"
          kicker="02 · Sentiment"
          title="Bull, bear, or just loud."
          body="Per-token sentiment scored over time. Trained on 18 months of post-and-price data, not naive keyword polarity. See the mood shift before the price does."
        >
          <VizSentiment />
        </FeatureCard>

        <FeatureCard
          icon="star"
          kicker="03 · Watchlist"
          title="Your tokens, with social overlays."
          body="A personal watchlist that pairs price with social signal. See mention velocity, sentiment, and reach right next to the candle. Group by narrative. Export to CSV."
        >
          <VizWatchlist />
        </FeatureCard>

        <FeatureCard
          icon="cpu"
          kicker="04 · Ask Hum"
          title="The AI that's read every post."
          body={`Hum is the research assistant that summarizes narratives, flags emerging trends, and cites every source by handle. It says “I’d watch this” — not “I think you might want to consider.”`}
        >
          <VizHum />
        </FeatureCard>
      </div>
    </section>
  )
}
