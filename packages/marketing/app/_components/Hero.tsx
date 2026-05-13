import BuzzDot from './BuzzDot'
import Button from './Button'

function HeroPanel() {
  return (
    <div
      className="hero-panel"
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        borderRadius: 14,
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 30px 60px -20px rgba(11,11,12,0.45), 0 0 0 1px rgba(11,11,12,0.08)',
        fontFamily: 'var(--font-mono)',
        transform: 'rotate(0.4deg)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--data-line)',
        }}
      >
        <BuzzDot />
        <span
          style={{
            font: '600 10px var(--font-sans)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--data-dim)',
          }}
        >
          Live feed · 14:02 UTC
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ font: '500 11px var(--font-mono)', color: 'var(--data-dim)' }}>
          3 tokens spiking
        </span>
      </div>

      {/* Chart area */}
      <div style={{ padding: '22px 22px 14px' }}>
        <div
          style={{
            font: '600 10px var(--font-sans)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--data-dim)',
            marginBottom: 8,
          }}
        >
          $PEPE · Δ buzz · 4h
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              font: '700 56px/1 var(--font-mono)',
              color: 'var(--data-amber)',
              letterSpacing: '-0.02em',
            }}
          >
            +412%
          </span>
          <span style={{ font: '600 14px var(--font-mono)', color: 'var(--data-pos)' }}>
            ▲ 48.9k mentions
          </span>
        </div>
        <svg
          viewBox="0 0 400 100"
          width="100%"
          height="100"
          style={{ marginTop: 10, display: 'block' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--data-amber)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--data-amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d="M0 90 L40 85 L80 80 L120 70 L160 60 L200 55 L240 45 L280 30 L320 20 L360 10 L400 6 L400 100 L0 100 Z"
            fill="url(#hg)"
          />
          <path
            d="M0 90 L40 85 L80 80 L120 70 L160 60 L200 55 L240 45 L280 30 L320 20 L360 10 L400 6"
            stroke="var(--data-amber)"
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Feed rows */}
      <div style={{ borderTop: '1px solid var(--data-line)' }}>
        {[
          { h: '@cobie',    t: 'watching $PEPE accumulate again. four wallets I tagged in march are buying.',  time: '2m' },
          { h: '@hsaka',    t: '$PEPE volume on coinbase pro is the cleanest it\'s been since may.',           time: '8m' },
          { h: '@gainzy222', t: 'i still think $PEPE 2x from here before the cycle ends',                    time: '12m' },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              padding: '10px 16px',
              borderBottom: i < 2 ? '1px solid var(--data-line)' : 'none',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: '#34343A',
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span style={{ font: '600 11px var(--font-mono)', color: 'var(--data-fg)' }}>
                  {m.h}
                </span>
                <span style={{ font: '500 10px var(--font-mono)', color: 'var(--data-dim)' }}>
                  · {m.time}
                </span>
              </div>
              <div style={{ font: '400 11px/1.45 var(--font-sans)', color: '#F6E9D4' }}>
                {m.t}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const TRUSTED_BY = ['DORVAL CONSTRUCTION', 'JP CLOUD ENGINEERING', 'SAUDADE CAFE', 'RUNTIME DESIGNS']

export default function Hero() {
  return (
    <section
      style={{
        padding: '72px 32px 40px',
        maxWidth: 1280,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.95fr',
        gap: 56,
        alignItems: 'center',
      }}
      className="hero-grid"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <BuzzDot />
          <div
            style={{
              font: '600 12px/1.2 var(--font-sans)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            Live · 2,140 mentions/min
          </div>
        </div>

        <div
          className="hero-display"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(48px, 7vw, 84px)',
            lineHeight: 0.98,
            letterSpacing: '0.005em',
            textTransform: 'uppercase',
            color: 'var(--fg-1)',
          }}
        >
          Hear<br />
          the market<br />
          before you<br />
          <span style={{ color: 'var(--buzz-500)' }}>see</span> it.
        </div>

        <div
          style={{
            font: '400 18px/1.55 var(--font-sans)',
            color: 'var(--fg-2)',
            maxWidth: 520,
          }}
        >
          TokenBuzz tracks real-time buzz, sentiment, and mentions across X for any token
          or keyword. The chart catches up later.
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 4,
            flexWrap: 'wrap',
          }}
        >
          <Button variant="primary" size="lg" iconRight="arrowR" href="#">
            Start tracking — free
          </Button>
          <Button variant="ghost" size="lg" icon="play" href="#how">
            See how it works
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            marginTop: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              font: '500 12px var(--font-mono)',
              color: 'var(--fg-3)',
              letterSpacing: '0.06em',
            }}
          >
            Trusted by analysts at
          </span>
          <div style={{ display: 'flex', gap: 18, opacity: 0.78, flexWrap: 'wrap' }}>
            {TRUSTED_BY.map(l => (
              <span
                key={l}
                style={{
                  font: '700 13px var(--font-sans)',
                  letterSpacing: '0.16em',
                  color: 'var(--fg-2)',
                }}
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <HeroPanel />
    </section>
  )
}
