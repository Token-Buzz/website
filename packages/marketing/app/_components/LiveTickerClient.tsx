'use client'

import { useState, useEffect } from 'react'
import {
  type TickerSnapshot,
  type TickerToken,
  SNAPSHOT_PATH,
  FALLBACK_TOKENS,
  TRENDING_THRESHOLD,
  displaySymbol,
  formatPrice,
  formatBuzz,
} from './tickerFormat'

interface Props {
  initialSnapshot: TickerSnapshot | null
}

export default function LiveTickerClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<TickerSnapshot | null>(initialSnapshot)

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(SNAPSHOT_PATH, { cache: 'no-store' })
        if (!res.ok) return
        const data: TickerSnapshot = await res.json()
        if (!data || !Array.isArray(data.tokens) || data.tokens.length === 0) return
        setSnapshot(data)
      } catch {
        // keep last-good snapshot on any failure
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const data: TickerToken[] =
    snapshot && snapshot.tokens.length > 0 ? snapshot.tokens : FALLBACK_TOKENS
  const items = [...data, ...data]

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
        {items.map((t, i) => (
          <div
            key={`${i}-${t.symbol}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--data-fg)', fontWeight: 600 }}>
              ${displaySymbol(t.symbol)}
            </span>
            <span style={{ color: 'var(--data-dim)' }}>{formatPrice(t.price)}</span>
            {t.deltaPct == null ? (
              <span style={{ color: 'var(--data-dim)' }}>—</span>
            ) : (
              <span
                style={{
                  color: t.deltaPct >= 0 ? 'var(--data-pos)' : 'var(--data-neg)',
                  fontWeight: 600,
                }}
              >
                {t.deltaPct >= 0 ? '▲' : '▼'}{' '}
                {t.deltaPct >= 0 ? '+' : '−'}{Math.abs(t.deltaPct).toFixed(2)}%
              </span>
            )}
            <span style={{ color: 'var(--data-dim)' }}>·</span>
            <span style={{ color: 'var(--data-amber)' }}>{formatBuzz(t.buzzDelta)}</span>
            {t.buzzDelta > TRENDING_THRESHOLD && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  padding: '1px 6px',
                  borderRadius: 4,
                  color: 'var(--data-amber)',
                  border: '1px solid var(--data-amber)',
                  textTransform: 'uppercase',
                }}
              >
                TRENDING
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
