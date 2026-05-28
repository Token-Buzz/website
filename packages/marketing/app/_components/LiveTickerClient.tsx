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
  isStale,
} from './tickerFormat'

interface Props {
  initialSnapshot: TickerSnapshot | null
}

export default function LiveTickerClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<TickerSnapshot | null>(initialSnapshot)
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    async function tick() {
      setNow(Date.now())
      try {
        const res = await fetch(SNAPSHOT_PATH, { cache: 'no-store' })
        if (!res.ok) return
        const data: TickerSnapshot = await res.json()
        if (!data || !Array.isArray(data.tokens) || data.tokens.length === 0) return
        setSnapshot(data)
      } catch {
        // keep last-good snapshot on any failure
      }
    }
    const initial = setTimeout(tick, 0)
    const id = setInterval(tick, 30_000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [])

  const usingFallback = !(snapshot && snapshot.tokens.length > 0)
  const data: TickerToken[] = usingFallback ? FALLBACK_TOKENS : snapshot!.tokens
  const stale = !usingFallback && snapshot != null && isStale(snapshot.updatedAt, now)
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
          animationPlayState: stale ? 'paused' : 'running',
          width: 'max-content',
        }}
      >
        {items.map((t, i) => (
          <a
            key={`${i}-${t.symbol}`}
            href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-up?token=${encodeURIComponent(displaySymbol(t.symbol))}`}
            rel="nofollow noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
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
          </a>
        ))}
      </div>
      {stale && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--data-dim)',
            background: 'linear-gradient(90deg, transparent, var(--data-bg) 45%)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--data-dim)',
            }}
          />
          data stale
        </div>
      )}
    </div>
  )
}
