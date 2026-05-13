import Button from './Button'

function StepVisualAdd() {
  return (
    <div
      style={{
        border: '1px solid var(--data-line)',
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--data-fg)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <span style={{ color: 'var(--data-amber)' }}>＋</span>
      <span style={{ color: 'var(--data-fg)' }}>$PEPE</span>
      <span
        style={{
          width: 1,
          height: 16,
          background: 'var(--accent)',
          animation: 'tb-cursor 1s steps(2) infinite',
        }}
      />
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10,
          color: 'var(--data-dim)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        ↵ track
      </span>
    </div>
  )
}

function StepVisualWatch() {
  return (
    <svg viewBox="0 0 300 130" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--data-amber)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--data-amber)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {[26, 65, 104].map(y => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="var(--data-line)" strokeDasharray="2 4" />
      ))}
      <path
        d="M0 110 L30 105 L60 95 L90 92 L120 78 L150 70 L180 55 L210 40 L240 22 L270 14 L300 8 L300 130 L0 130 Z"
        fill="url(#sw)"
      />
      <path
        d="M0 110 L30 105 L60 95 L90 92 L120 78 L150 70 L180 55 L210 40 L240 22 L270 14 L300 8"
        stroke="var(--data-amber)"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="300" cy="8" r="4" fill="var(--accent)">
        <animate attributeName="r"       values="4;7;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function StepVisualAsk() {
  return (
    <div
      style={{
        border: '1px solid var(--data-line)',
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.55,
        color: 'var(--data-fg)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          color: 'var(--data-dim)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        You
      </div>
      <div>What's pushing $PEPE today?</div>
      <div
        style={{
          color: 'var(--data-amber)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        Hum
      </div>
      <div>Three big wallets surfaced overnight. @cobie + 2 others. Same cluster as the March run.</div>
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    t: 'Add a keyword or token',
    b: 'Type a ticker, project name, or even a narrative. We start ingesting matching posts from 412k X handles immediately — no waiting.',
    visual: <StepVisualAdd />,
  },
  {
    n: '02',
    t: 'Watch the buzz unfold',
    b: 'Mentions are scored by reach, accuracy, and novelty. Spikes are flagged. Sentiment shifts live. The feed updates faster than the chart.',
    visual: <StepVisualWatch />,
  },
  {
    n: '03',
    t: 'Ask Hum what it means',
    b: 'Need a second opinion? Hum reads every post in the window, surfaces the narrative, and cites the handles driving it. Five seconds, every source.',
    visual: <StepVisualAsk />,
  },
]

export default function HowItWorks() {
  return (
    <section
      id="how"
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        padding: '96px 32px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            font: '600 12px/1.2 var(--font-sans)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--data-amber)',
            marginBottom: 16,
          }}
        >
          How it works · 3 steps
        </div>
        <h2
          style={{
            font: '600 44px/1.05 var(--font-sans)',
            letterSpacing: '-0.018em',
            color: 'var(--data-fg)',
            maxWidth: 820,
            marginBottom: 56,
            margin: '0 0 56px',
          }}
        >
          The market is loud. We sort the loud into signal.
        </h2>

        <div
          className="how-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}
        >
          {STEPS.map(s => (
            <div
              key={s.n}
              style={{
                borderTop: '1px solid var(--data-line)',
                paddingTop: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ font: '600 13px var(--font-mono)', color: 'var(--data-amber)' }}>
                  {s.n}
                </span>
                <span
                  style={{
                    font: '500 10px var(--font-mono)',
                    color: 'var(--data-dim)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Step
                </span>
              </div>
              <div style={{ height: 130 }}>{s.visual}</div>
              <div
                style={{
                  font: '600 22px/1.2 var(--font-sans)',
                  color: 'var(--data-fg)',
                  letterSpacing: '-0.012em',
                }}
              >
                {s.t}
              </div>
              <div
                style={{
                  font: '400 14px/1.6 var(--font-sans)',
                  color: 'var(--data-dim)',
                }}
              >
                {s.b}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 56,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="primary" size="lg" iconRight="arrowR" href="#">
            Start tracking — free
          </Button>
          <span
            style={{
              font: '500 12px var(--font-mono)',
              color: 'var(--data-dim)',
              letterSpacing: '0.06em',
            }}
          >
            No credit card. 5 tokens free, forever.
          </span>
        </div>
      </div>
    </section>
  )
}
