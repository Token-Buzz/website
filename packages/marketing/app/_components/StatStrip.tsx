interface StatProps {
  value: string
  label: string
  color?: string
}

function Stat({ value, label, color = 'var(--fg-1)' }: StatProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          font: '600 44px/0.95 var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: '500 12px var(--font-sans)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        {label}
      </div>
    </div>
  )
}

const STATS: StatProps[] = [
  { value: '48K',  label: 'Tokens indexed' },
  { value: '2.4M', label: 'Tweets analyzed' },
  { value: '12s',  label: 'Median spike-to-alert', color: 'var(--buzz-500)' },
  { value: '186K', label: 'Authors tracked' },
]

export default function StatStrip() {
  return (
    <section style={{ padding: '0 32px' }}>
      <div
        className="stat-strip"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: '32px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
        }}
      >
        {STATS.map(s => <Stat key={s.label} {...s} />)}
      </div>
    </section>
  )
}
