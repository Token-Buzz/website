'use client'

import { useState, useEffect } from 'react'
import {
  Card, Eyebrow, Ticker, Pill, Delta,
  fmtCount, fmtPrice,
} from '../_dashboard/primitives'
import type { Sentiment } from '../_dashboard/types'

// ── Types ──────────────────────────────────────────────────────────────────

type MoverWindow = '1H' | '24H' | '7D'
type SortBy = 'buzz' | 'mentions' | 'sentiment'
type SortDir = 'desc' | 'asc'

interface Mover {
  symbol: string
  /** Percentage buzz delta for the selected window */
  buzzDelta: number
  mentions: number
  price: number
  change24h: number
  sentiment: Sentiment
  updatedAt: string
}

interface ApiResponse {
  movers: Mover[]
}

// ── Sentiment sort weight ──────────────────────────────────────────────────
// Categorical proxy: bull → neu → bear for 'desc', reversed for 'asc'.
// A numeric sentiment-swing magnitude does not exist in v1.

const SENTIMENT_RANK: Record<Sentiment, number> = { bull: 2, neu: 1, bear: 0 }

function sortMovers(movers: Mover[], by: SortBy, dir: SortDir): Mover[] {
  const sorted = [...movers].sort((a, b) => {
    let delta = 0
    if (by === 'buzz')      delta = a.buzzDelta - b.buzzDelta
    if (by === 'mentions')  delta = a.mentions - b.mentions
    if (by === 'sentiment') delta = SENTIMENT_RANK[a.sentiment] - SENTIMENT_RANK[b.sentiment]
    return dir === 'desc' ? -delta : delta
  })
  return sorted
}

// ── SortHead (mirrors WatchlistView pattern) ───────────────────────────────

function SortHead({
  children, active, dir, onToggle, align = 'right',
}: {
  children: React.ReactNode
  active: boolean
  dir: SortDir
  onToggle: () => void
  align?: 'left' | 'right'
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        font: '600 10px/1 var(--font-sans)',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: active ? 'var(--fg-1)' : 'var(--fg-3)',
        cursor: 'pointer',
        textAlign: align,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 4,
        userSelect: 'none',
      }}
    >
      {children}
      {active && <span style={{ fontSize: 9 }}>{dir === 'desc' ? '▼' : '▲'}</span>}
    </div>
  )
}

// ── Table header / row grid ────────────────────────────────────────────────

// symbol | buzz-delta | mentions | price | 24h-change | sentiment
const GRID = '140px 1fr 1fr 100px 100px 90px'

function TableHead({
  sortBy, sortDir, onSort,
}: {
  sortBy: SortBy
  sortDir: SortDir
  onSort: (col: SortBy) => void
}) {
  const toggle = (col: SortBy) => onSort(col)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        alignItems: 'center',
        gap: 16,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
    >
      <div
        style={{
          font: '600 10px/1 var(--font-sans)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        Token
      </div>
      <SortHead active={sortBy === 'buzz'} dir={sortDir} onToggle={() => toggle('buzz')}>
        Buzz Δ
      </SortHead>
      <SortHead active={sortBy === 'mentions'} dir={sortDir} onToggle={() => toggle('mentions')}>
        Mentions
      </SortHead>
      <div
        style={{
          font: '600 10px/1 var(--font-sans)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          textAlign: 'right',
        }}
      >
        Price
      </div>
      <div
        style={{
          font: '600 10px/1 var(--font-sans)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          textAlign: 'right',
        }}
      >
        24h
      </div>
      <SortHead active={sortBy === 'sentiment'} dir={sortDir} onToggle={() => toggle('sentiment')} align="right">
        Sent
      </SortHead>
    </div>
  )
}

function MoverRow({ mover }: { mover: Mover }) {
  const sentTone: 'bull' | 'bear' | 'neu' = mover.sentiment
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-hairline)',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Symbol */}
      <Ticker symbol={mover.symbol} />

      {/* Buzz Δ */}
      <div style={{ textAlign: 'right' }}>
        <Delta value={mover.buzzDelta} format="pct" />
      </div>

      {/* Mentions */}
      <div
        style={{
          textAlign: 'right',
          font: '600 13px var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--fg-1)',
        }}
      >
        {fmtCount(mover.mentions)}
      </div>

      {/* Price */}
      <div
        style={{
          textAlign: 'right',
          font: '600 13px var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--fg-1)',
        }}
      >
        {fmtPrice(mover.price)}
      </div>

      {/* 24h change */}
      <div style={{ textAlign: 'right' }}>
        <Delta value={mover.change24h} format="pct" />
      </div>

      {/* Sentiment */}
      <div style={{ textAlign: 'right' }}>
        <Pill tone={sentTone}>{mover.sentiment}</Pill>
      </div>
    </div>
  )
}

// ── State labels ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--fg-3)',
        font: '500 13px var(--font-sans)',
      }}
    >
      No movers found for this window.
    </div>
  )
}

function LoadingState() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--fg-3)',
        font: '500 13px var(--font-sans)',
      }}
    >
      Loading…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--neg)',
        font: '500 13px var(--font-sans)',
      }}
    >
      {message}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

const WINDOWS: MoverWindow[] = ['1H', '24H', '7D']

export default function MoversPage() {
  const [window, setWindow] = useState<MoverWindow>('1H')
  const [sortBy, setSortBy] = useState<SortBy>('buzz')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [movers, setMovers] = useState<Mover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMovers() {
      setLoading(true)
      setError(null)
      try {
        const param = window.toLowerCase()
        const res = await fetch(`/api/movers?window=${param}&limit=50`)
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data: ApiResponse = await res.json()
        if (!cancelled) {
          setMovers(data.movers ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong.')
          setMovers([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchMovers()

    return () => {
      cancelled = true
    }
  }, [window])

  function handleSort(col: SortBy) {
    if (col === sortBy) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const sorted = sortMovers(movers, sortBy, sortDir)

  return (
    <div
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Movers</Eyebrow>
        <h1
          style={{
            font: '600 28px/1.15 var(--font-sans)',
            letterSpacing: '-0.015em',
            color: 'var(--fg-1)',
            margin: 0,
          }}
        >
          Top movers
        </h1>
      </div>

      {/* ── Controls row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Time-window pill group — styled like Shell TopBar */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}
        >
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                border: 'none',
                padding: '5px 11px',
                borderRadius: 999,
                cursor: 'pointer',
                font: '600 11px var(--font-sans)',
                background: window === w ? 'var(--bg-elevated)' : 'transparent',
                color: window === w ? 'var(--fg-1)' : 'var(--fg-2)',
                boxShadow: window === w ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Sort controls — filter-bar pill group style from WatchlistView */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {(['buzz', 'mentions', 'sentiment'] as SortBy[]).map((col) => (
            <button
              key={col}
              onClick={() => handleSort(col)}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                font: '600 11px var(--font-sans)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: sortBy === col ? 'var(--inv-bg)' : 'transparent',
                color: sortBy === col ? 'var(--inv-fg)' : 'var(--fg-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {col === 'buzz' ? 'Buzz Δ' : col === 'mentions' ? 'Mentions' : 'Sentiment'}
              {sortBy === col && (
                <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Result count */}
        {!loading && !error && (
          <span
            style={{
              font: '500 12px var(--font-mono)',
              color: 'var(--fg-3)',
            }}
          >
            {sorted.length} tokens
          </span>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {/* Horizontal scroll wrapper for mobile */}
        <div style={{ overflowX: 'auto', minWidth: 0 }}>
          <div style={{ minWidth: 640 }}>
            <TableHead sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : sorted.length === 0 ? (
              <EmptyState />
            ) : (
              sorted.map((m) => <MoverRow key={m.symbol} mover={m} />)
            )}
          </div>
        </div>
      </Card>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      {!loading && !error && sorted.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            font: '500 11px var(--font-mono)',
            color: 'var(--fg-4)',
            letterSpacing: '0.04em',
          }}
        >
          Buzz Δ calculated over the selected window · updated every 60s
        </div>
      )}
    </div>
  )
}
