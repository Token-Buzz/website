const TICKER_DATA = [
  { s: 'PEPE',  p: '$0.0000182',  d: 24.10,  b: 'buzz +412%' },
  { s: 'SOL',   p: '$182.40',     d: -2.31,  b: 'buzz −18%' },
  { s: 'TURBO', p: '$0.0041',     d: 8.07,   b: 'buzz +96%' },
  { s: 'BONK',  p: '$0.000033',   d: -4.62,  b: 'buzz +7%' },
  { s: 'WIF',   p: '$2.41',       d: 12.40,  b: 'buzz +84%' },
  { s: 'MOG',   p: '$0.00000176', d: 41.20,  b: 'buzz +218%' },
  { s: 'BRETT', p: '$0.092',      d: -1.18,  b: 'buzz +22%' },
  { s: 'DOGE',  p: '$0.171',      d: 0.42,   b: 'buzz −4%' },
  { s: 'FART',  p: '$0.0014',     d: 18.30,  b: 'buzz +132%' },
]

export default function LiveTicker() {
  const items = [...TICKER_DATA, ...TICKER_DATA]
  return (
    <div
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        overflow: 'hidden',
        padding: '12px 0',
        position: 'relative',
        borderTop: '1px solid var(--data-line)',
        borderBottom: '1px solid var(--data-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 36,
          whiteSpace: 'nowrap',
          animation: 'tb-marquee 38s linear infinite',
          width: 'max-content',
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>${it.s}</span>
            <span style={{ color: 'var(--data-dim)' }}>{it.p}</span>
            <span
              style={{
                color: it.d >= 0 ? 'var(--data-pos)' : 'var(--data-neg)',
                fontWeight: 600,
              }}
            >
              {it.d >= 0 ? '▲' : '▼'} {it.d >= 0 ? '+' : '−'}{Math.abs(it.d).toFixed(2)}%
            </span>
            <span style={{ color: 'var(--data-dim)' }}>·</span>
            <span style={{ color: 'var(--data-amber)' }}>{it.b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
