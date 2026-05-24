'use client'

import { useState } from 'react'
import { Icon, Button, Eyebrow, Ticker, BuzzDot, Sparkline, Delta, fmtCount } from './primitives'
import { useIsMobile } from './useIsMobile'
import type { Token } from './types'

const SAMPLE_TOKENS: Token[] = [
  { sym: 'PEPE',  name: 'Pepe',      price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
  { sym: 'TURBO', name: 'Turbo',     price: 0.0041,    d24:  8.07, mentions:  3100, dbuzz:  96, sent: 'bull', spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true },
  { sym: 'SOL',   name: 'Solana',    price: 182.40,    d24: -2.31, mentions: 12400, dbuzz: -18, sent: 'bear', spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
  { sym: 'BONK',  name: 'Bonk',      price: 0.000033,  d24: -4.62, mentions: 22700, dbuzz:   7, sent: 'neu',  spark: [12,13,12,11,12,11,11,10,11,10,10,11,10,9,10] },
  { sym: 'WIF',   name: 'dogwifhat', price: 2.41,      d24: 12.40, mentions:  9800, dbuzz:  84, sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16] },
  { sym: 'BRETT', name: 'Brett',     price: 0.092,     d24: -1.18, mentions:  4400, dbuzz:  22, sent: 'neu',  spark: [10,11,11,10,11,11,12,11,12,12,11,12,12,12,11] },
  { sym: 'MOG',   name: 'Mog Coin',  price: 0.00000176,d24: 41.20, mentions:  6700, dbuzz: 218, sent: 'bull', spark: [2,3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true },
  { sym: 'DOGE',  name: 'Dogecoin',  price: 0.171,     d24:  0.42, mentions: 18900, dbuzz:  -4, sent: 'neu',  spark: [12,12,11,12,12,12,11,12,12,12,11,12,12,12,12] },
]

type FilterType = 'all' | 'bull' | 'bear' | 'live'
type SortKey = keyof Pick<Token, 'sym' | 'price' | 'd24' | 'dbuzz' | 'mentions'>

interface Sort { k: SortKey; dir: 'asc' | 'desc' }

// ── FilterBar ──────────────────────────────────────────────────────────────

function FilterBar({ filter, setFilter, isMobile }: {
  filter: FilterType
  setFilter: (f: FilterType) => void
  isMobile: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 8 : 10,
      padding: isMobile ? '10px 12px' : '12px 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      <Eyebrow>Memecoins · 12 tokens</Eyebrow>
      {isMobile ? null : <div style={{ flex: 1 }} />}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        rowGap: 6,
        width: isMobile ? '100%' : undefined,
      }}>
        {/* Filter pills */}
        <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
          {(['all', 'bull', 'bear', 'live'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                font: '600 11px var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: filter === f ? 'var(--inv-bg)' : 'transparent',
                color: filter === f ? 'var(--inv-fg)' : 'var(--fg-2)',
              }}
            >{f}</button>
          ))}
        </div>
        <Button variant="ghost" size="sm" icon="filter">Filters</Button>
        <Button variant="ghost" size="sm" icon="plus">Add token</Button>
      </div>
    </div>
  )
}

// ── SortHead ───────────────────────────────────────────────────────────────

function SortHead({ children, k, sort, setSort, align = 'left' }: {
  children: React.ReactNode; k: SortKey; sort: Sort; setSort: (s: Sort) => void; align?: 'left' | 'right'
}) {
  const active = sort.k === k
  return (
    <div
      onClick={() => setSort({ k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
      style={{
        font: '600 10px/1 var(--font-sans)', letterSpacing: '0.16em', textTransform: 'uppercase',
        color: active ? 'var(--fg-1)' : 'var(--fg-3)', cursor: 'pointer', textAlign: align,
        display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4,
      }}
    >
      {children}
      {active && <span style={{ fontSize: 9 }}>{sort.dir === 'desc' ? '▼' : '▲'}</span>}
    </div>
  )
}

// ── Desktop grid ───────────────────────────────────────────────────────────

const GRID = '32px 140px 1fr 120px 100px 160px 28px'

interface WatchlistRowProps {
  t: Token
  starred: boolean
  onStar: () => void
  onOpen: () => void
  selected: boolean
}

function WatchlistRow({ t, starred, onStar, onOpen, selected }: WatchlistRowProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 16,
        padding: '12px 20px', borderBottom: '1px solid var(--border-hairline)',
        background: selected ? 'var(--bg-elevated)' : 'transparent', cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onStar() }}
        style={{ color: starred ? 'var(--buzz-500)' : 'var(--ink-300)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
      >★</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ticker symbol={t.sym} />
        <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-3)' }}>{t.name}</span>
      </div>
      <Sparkline points={t.spark} color={t.d24 >= 0 ? 'var(--pos)' : 'var(--neg)'} width={180} height={28} fill />
      <div style={{ textAlign: 'right', font: '600 14px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>—</div>
      <div style={{ textAlign: 'right' }}><Delta value={t.d24} /></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-2)' }}>{fmtCount(t.mentions)}</span>
        <Delta value={t.dbuzz} style={{ fontSize: 12 }} />
        {t.live && <BuzzDot />}
      </div>
      <Icon name="chevR" size={14} style={{ color: 'var(--fg-4)' }} />
    </div>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────
// Star + ticker + name on top line; price / 24h / mentions·Δbuzz on second
// line; sparkline on the right side; chevron tap opens detail.
// The star tap is stopped from propagating so it doesn't open the detail.

interface WatchlistCardProps {
  t: Token
  starred: boolean
  onStar: () => void
  onOpen: () => void
  selected: boolean
}

function WatchlistCard({ t, starred, onStar, onOpen, selected }: WatchlistCardProps) {
  const sparkColor = t.d24 >= 0 ? 'var(--pos)' : 'var(--neg)'
  return (
    <div
      onClick={onOpen}
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-hairline)',
        background: selected ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 60,
      }}
    >
      {/* Row 1: star · ticker · name · sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          onClick={(e) => { e.stopPropagation(); onStar() }}
          style={{
            color: starred ? 'var(--buzz-500)' : 'var(--ink-300)',
            fontSize: 16, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
          }}
        >★</span>
        <Ticker symbol={t.sym} />
        <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        {t.live && <BuzzDot />}
        <Sparkline points={t.spark} color={sparkColor} width={60} height={22} fill />
        <Icon name="chevR" size={14} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
      </div>

      {/* Row 2: price · 24h · mentions · Δbuzz */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 4, paddingLeft: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>Price</span>
          <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>—</span>
        </div>
        <span style={{ color: 'var(--border-strong)', fontSize: 10 }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>24h</span>
          <Delta value={t.d24} style={{ fontSize: 12 }} />
        </div>
        <span style={{ color: 'var(--border-strong)', fontSize: 10 }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>Mentions</span>
          <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtCount(t.mentions)}</span>
          <Delta value={t.dbuzz} style={{ fontSize: 11 }} />
        </div>
      </div>
    </div>
  )
}

// ── WatchlistView ──────────────────────────────────────────────────────────

interface WatchlistViewProps {
  tokens?: Token[]
  onSelectToken?: (t: Token | null) => void
  selectedToken?: Token | null
}

export function WatchlistView({ tokens = SAMPLE_TOKENS, onSelectToken, selectedToken }: WatchlistViewProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<Sort>({ k: 'dbuzz', dir: 'desc' })
  const [starred, setStarred] = useState(new Set(['PEPE', 'SOL', 'WIF']))

  const isMobile = useIsMobile()

  let rows = [...tokens]
  if (filter === 'bull') rows = rows.filter((t) => t.sent === 'bull')
  if (filter === 'bear') rows = rows.filter((t) => t.sent === 'bear')
  if (filter === 'live') rows = rows.filter((t) => t.live)
  rows.sort((a, b) => {
    const av = a[sort.k] as number, bv = b[sort.k] as number
    return sort.dir === 'desc' ? bv - av : av - bv
  })

  const toggleStar = (sym: string) => {
    const s = new Set(starred)
    s.has(sym) ? s.delete(sym) : s.add(sym)
    setStarred(s)
  }

  const handleOpen = (t: Token) => onSelectToken?.(selectedToken?.sym === t.sym ? null : t)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FilterBar filter={filter} setFilter={setFilter} isMobile={isMobile} />

      {isMobile ? (
        // Mobile: stacked cards, no column header row
        <div>
          {rows.map((t) => (
            <WatchlistCard
              key={t.sym}
              t={t}
              starred={starred.has(t.sym)}
              onStar={() => toggleStar(t.sym)}
              onOpen={() => handleOpen(t)}
              selected={selectedToken?.sym === t.sym}
            />
          ))}
        </div>
      ) : (
        // Desktop: sticky column header + grid rows
        <>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1 }}>
            <div />
            <SortHead k="sym"     sort={sort} setSort={setSort}>Ticker</SortHead>
            <SortHead k="sym"     sort={sort} setSort={setSort}>15min · sparkline</SortHead>
            <SortHead k="price"   sort={sort} setSort={setSort} align="right">Price</SortHead>
            <SortHead k="d24"     sort={sort} setSort={setSort} align="right">24h</SortHead>
            <SortHead k="dbuzz"   sort={sort} setSort={setSort} align="right">Mentions · Δ buzz</SortHead>
            <div />
          </div>
          <div>
            {rows.map((t) => (
              <WatchlistRow
                key={t.sym}
                t={t}
                starred={starred.has(t.sym)}
                onStar={() => toggleStar(t.sym)}
                onOpen={() => handleOpen(t)}
                selected={selectedToken?.sym === t.sym}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
