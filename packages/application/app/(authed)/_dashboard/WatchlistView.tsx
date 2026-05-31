'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon, Button, Eyebrow, Ticker, BuzzDot, Sparkline, Delta, fmtCount, fmtPrice } from './primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { suggestQueryForTicker } from '@monorepo-template/core/lib/watchlist-query'
import type { Token, WatchlistEntry, OHLCVBar, LiveFeedTweet } from './types'
import { WATCHLIST_CHANGED_EVENT } from './watchlistEvents'

// ── FilterBar ──────────────────────────────────────────────────────────────

type QuickFilter = 'all' | 'bull' | 'bear' | 'live'
type SortKey = keyof Pick<Token, 'sym' | 'price' | 'd24' | 'dbuzz' | 'mentions'>
interface Sort { k: SortKey; dir: 'asc' | 'desc' }

interface FiltersState {
  sentiment: 'any' | 'bull' | 'bear' | 'neu'
  hasAlert: boolean
}

// ── Add Token Modal ────────────────────────────────────────────────────────

function AddTokenModal({ onClose, onAdded }: {
  onClose: () => void
  onAdded: (entry: WatchlistEntry) => void
}) {
  const [symbol, setSymbol] = useState('')
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  // Auto-fill query when user types a symbol
  const handleSymbolChange = (val: string) => {
    setSymbol(val)
    if (val.trim().length > 0) {
      try {
        setQuery(suggestQueryForTicker(val))
      } catch {
        // ignore if symbol is partially typed
      }
    } else {
      setQuery('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbol.trim()) { setError('Symbol is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { symbol: symbol.trim().toUpperCase() }
      if (query.trim()) body.query = query.trim()
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({ error: `Request failed: ${res.status}` })) as Record<string, unknown>
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Request failed: ${res.status}`)
      onAdded(json.entry as WatchlistEntry)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
  }

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: isMobile ? '12px 12px 0 0' : 10,
    width: isMobile ? '100%' : 440,
    padding: '24px 24px 28px',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ font: '600 16px var(--font-sans)', color: 'var(--fg-1)', flex: 1 }}>Add token</span>
          <Button variant="quiet" size="sm" icon="close" onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>Symbol</Eyebrow>
              <input
                autoFocus
                type="text"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                placeholder="e.g. PEPE"
                style={{
                  font: '500 14px var(--font-mono)', padding: '9px 12px',
                  border: '1px solid var(--border-strong)', borderRadius: 6,
                  background: 'var(--bg-sunken)', color: 'var(--fg-1)', outline: 'none',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>Query</Eyebrow>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. $PEPE OR #PEPE"
                style={{
                  font: '500 13px var(--font-mono)', padding: '9px 12px',
                  border: '1px solid var(--border-strong)', borderRadius: 6,
                  background: 'var(--bg-sunken)', color: 'var(--fg-1)', outline: 'none',
                }}
              />
              <span style={{ font: '400 11px var(--font-sans)', color: 'var(--fg-4)' }}>
                Auto-filled from symbol. Edit freely.
              </span>
            </label>
            {error && <div style={{ font: '500 12px var(--font-sans)', color: 'var(--neg)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add token'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Filters Popover ────────────────────────────────────────────────────────

function FiltersPopover({ filters, onFiltersChange, anchorEl, onClose }: {
  filters: FiltersState
  onFiltersChange: (f: FiltersState) => void
  anchorEl: HTMLElement | null
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Derive position from anchorEl at render time — no setState needed
  const rect = anchorEl?.getBoundingClientRect()
  const pos = { top: (rect?.bottom ?? 0) + 6, left: rect?.left ?? 0 }

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          !anchorEl?.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [anchorEl, onClose])

  const sentiments: Array<{ value: FiltersState['sentiment']; label: string }> = [
    { value: 'any', label: 'Any' },
    { value: 'bull', label: 'Bull' },
    { value: 'bear', label: 'Bear' },
    { value: 'neu', label: 'Neutral' },
  ]

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 50,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 16, minWidth: 200,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Sentiment</Eyebrow>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {sentiments.map((s) => (
              <button
                key={s.value}
                onClick={() => onFiltersChange({ ...filters, sentiment: s.value })}
                style={{
                  border: '1px solid var(--border)', borderRadius: 4, padding: '5px 10px',
                  cursor: 'pointer', font: '600 11px var(--font-sans)',
                  background: filters.sentiment === s.value ? 'var(--inv-bg)' : 'transparent',
                  color: filters.sentiment === s.value ? 'var(--inv-fg)' : 'var(--fg-2)',
                }}
              >{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>Has alert</Eyebrow>
          <button
            role="switch"
            aria-checked={filters.hasAlert}
            onClick={() => onFiltersChange({ ...filters, hasAlert: !filters.hasAlert })}
            style={{
              width: 32, height: 18, borderRadius: 999, border: 'none',
              background: filters.hasAlert ? 'var(--buzz-500)' : 'var(--border-strong)',
              cursor: 'pointer', position: 'relative', padding: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: filters.hasAlert ? 16 : 2,
              width: 14, height: 14, borderRadius: '50%', background: '#fff',
              transition: 'left 150ms',
            }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FilterBar ──────────────────────────────────────────────────────────────

function FilterBar({ filter, setFilter, isMobile, tokenCount, onAddToken, onFiltersOpen, filtersActive }: {
  filter: QuickFilter
  setFilter: (f: QuickFilter) => void
  isMobile: boolean
  tokenCount: number
  onAddToken: () => void
  onFiltersOpen: (e: React.MouseEvent<HTMLButtonElement>) => void
  filtersActive: boolean
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
      <Eyebrow>Watchlist · {tokenCount} token{tokenCount !== 1 ? 's' : ''}</Eyebrow>
      {isMobile ? null : <div style={{ flex: 1 }} />}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        flexWrap: 'wrap', rowGap: 6,
        width: isMobile ? '100%' : undefined,
      }}>
        {/* Quick filter pills */}
        <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
          {(['all', 'bull', 'bear', 'live'] as QuickFilter[]).map((f) => (
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
        <Button
          variant="ghost" size="sm" icon="filter"
          onClick={onFiltersOpen}
          style={filtersActive ? { borderColor: 'var(--buzz-500)', color: 'var(--buzz-500)' } : undefined}
        >Filters</Button>
        <Button variant="ghost" size="sm" icon="plus" onClick={onAddToken}>Add token</Button>
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

// drag handle + star + ticker + sparkline + price + 24h + mentions + actions
const GRID = '16px 32px 140px 1fr 120px 100px 160px 64px'

interface WatchlistRowProps {
  t: Token
  index: number
  total: number
  starred: boolean
  onStar: () => void
  onOpen: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  selected: boolean
  // drag props
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function WatchlistRow({ t, index, total, starred, onStar, onOpen, onDelete, onMoveUp, onMoveDown, selected, onDragStart, onDragOver, onDrop }: WatchlistRowProps) {
  const priceDisplay = t.price > 0 ? fmtPrice(t.price) : '—'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onOpen}
      style={{
        display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 16,
        padding: '12px 20px', borderBottom: '1px solid var(--border-hairline)',
        background: selected ? 'var(--bg-elevated)' : 'transparent', cursor: 'pointer',
      }}
    >
      {/* Drag handle */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ color: 'var(--fg-4)', cursor: 'grab', fontSize: 11, lineHeight: 1, letterSpacing: 1, userSelect: 'none' }}
        title="Drag to reorder"
      >&#8942;&#8942;</div>

      {/* Star */}
      <div
        onClick={(e) => { e.stopPropagation(); onStar() }}
        style={{ color: starred ? 'var(--buzz-500)' : 'var(--ink-300)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
      >★</div>

      {/* Ticker + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ticker symbol={t.sym} />
        <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-3)' }}>{t.name}</span>
      </div>

      {/* Sparkline — derived from recent price bars if available, otherwise placeholder */}
      <Sparkline points={t.spark} color={t.d24 >= 0 ? 'var(--pos)' : 'var(--neg)'} width={180} height={28} fill />

      {/* Price */}
      <div style={{ textAlign: 'right', font: '600 14px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        {priceDisplay}
      </div>

      {/* 24h delta */}
      <div style={{ textAlign: 'right' }}><Delta value={t.d24} /></div>

      {/* Mentions + buzz delta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-2)' }}>{fmtCount(t.mentions)}</span>
        <Delta value={t.dbuzz} style={{ fontSize: 12 }} />
        {t.live && <BuzzDot />}
      </div>

      {/* Actions: delete + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Remove from watchlist"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--fg-4)', padding: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center',
          }}
        >
          <Icon name="close" size={12} />
        </button>
        <Icon name="chevR" size={14} style={{ color: 'var(--fg-4)' }} />
      </div>
    </div>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────

interface WatchlistCardProps {
  t: Token
  index: number
  total: number
  starred: boolean
  onStar: () => void
  onOpen: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  selected: boolean
}

function WatchlistCard({ t, index, total, starred, onStar, onOpen, onDelete, onMoveUp, onMoveDown, selected }: WatchlistCardProps) {
  const sparkColor = t.d24 >= 0 ? 'var(--pos)' : 'var(--neg)'
  const priceDisplay = t.price > 0 ? fmtPrice(t.price) : '—'
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
      {/* Row 1: star · ticker · name · order controls · sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          onClick={(e) => { e.stopPropagation(); onStar() }}
          style={{
            color: starred ? 'var(--buzz-500)' : 'var(--ink-300)',
            fontSize: 16, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: 12, margin: -12,
          }}
        >★</span>
        <Ticker symbol={t.sym} />
        <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        {t.live && <BuzzDot />}
        {/* Mobile reorder buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            disabled={index === 0}
            style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? 'var(--fg-5)' : 'var(--fg-3)', padding: '1px 4px', fontSize: 10 }}
            title="Move up"
          >▲</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            disabled={index === total - 1}
            style={{ border: 'none', background: 'transparent', cursor: index === total - 1 ? 'default' : 'pointer', color: index === total - 1 ? 'var(--fg-5)' : 'var(--fg-3)', padding: '1px 4px', fontSize: 10 }}
            title="Move down"
          >▼</button>
        </div>
        <Sparkline points={t.spark} color={sparkColor} width={60} height={22} fill />
        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-4)', padding: 4, flexShrink: 0 }}
          title="Remove"
        ><Icon name="close" size={12} /></button>
        <Icon name="chevR" size={14} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
      </div>

      {/* Row 2: price · 24h · mentions · Δbuzz */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 4, paddingLeft: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ font: '500 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>Price</span>
          <span style={{ font: '600 12px var(--font-mono)', color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>{priceDisplay}</span>
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

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onAddToken }: { onAddToken: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', gap: 16, color: 'var(--fg-3)',
    }}>
      <div style={{ fontSize: 32 }}>★</div>
      <div style={{ font: '600 15px var(--font-sans)', color: 'var(--fg-2)' }}>Your watchlist is empty</div>
      <div style={{ font: '400 13px var(--font-sans)', textAlign: 'center', maxWidth: 280 }}>
        Add tokens to track price, mentions, and sentiment from a single view.
      </div>
      <Button variant="primary" size="sm" icon="plus" onClick={onAddToken}>Add your first token</Button>
    </div>
  )
}

// ── Per-row data fetching helpers ──────────────────────────────────────────

interface RowData {
  price: number
  d24: number
  // Sparkline from last 15 daily close prices; falls back to a flat line placeholder
  spark: number[]
  mentions: number
  dbuzz: number
  sent: 'bull' | 'bear' | 'neu'
  live: boolean
}

async function fetchRowData(symbol: string, query: string): Promise<RowData> {
  // Fetch price bars (1d interval) and live-feed mentions in parallel
  const [priceRes, feedRes] = await Promise.allSettled([
    fetch(`/api/price/${encodeURIComponent(symbol)}?interval=1d`),
    fetch(`/api/live-feed?token=${encodeURIComponent(query)}&limit=200`),
  ])

  let price = 0
  let d24 = 0
  // Use close prices for sparkline (up to 15 bars); placeholder if unavailable
  let spark: number[] = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]

  if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
    const data = await priceRes.value.json() as { bars?: OHLCVBar[] }
    const bars = data.bars ?? []
    if (bars.length >= 2) {
      const last = bars[bars.length - 1]
      const prev = bars[bars.length - 2]
      price = last.close
      d24 = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0
    }
    // Build sparkline from up to last 15 close prices
    if (bars.length > 0) {
      spark = bars.slice(-15).map((b) => b.close)
    }
  }

  let mentions = 0
  let dbuzz = 0
  let sent: 'bull' | 'bear' | 'neu' = 'neu'
  let live = false

  if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
    const data = await feedRes.value.json() as { tweets?: LiveFeedTweet[] }
    const tweets = data.tweets ?? []
    mentions = tweets.length
    live = mentions > 0

    const bullCount = tweets.filter((tw) => tw.sentiment === 'bull').length
    const bearCount = tweets.filter((tw) => tw.sentiment === 'bear').length

    if (bullCount > bearCount) sent = 'bull'
    else if (bearCount > bullCount) sent = 'bear'
    else sent = 'neu'

    // dbuzz: compare first-half vs second-half of the returned tweets as a rough delta
    const half = Math.floor(tweets.length / 2)
    const recent = tweets.slice(0, half).length
    const older = tweets.slice(half).length
    dbuzz = older > 0 ? Math.round(((recent - older) / older) * 100) : 0
  }

  return { price, d24, spark, mentions, dbuzz, sent, live }
}

// ── WatchlistView ──────────────────────────────────────────────────────────

interface WatchlistViewProps {
  onSelectToken?: (t: Token | null) => void
  selectedToken?: Token | null
  initialFocus?: string | null
  autoOpenAdd?: boolean
}

export function WatchlistView({ onSelectToken, selectedToken, initialFocus, autoOpenAdd }: WatchlistViewProps) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Per-entry enriched data keyed by entryId
  const [rowData, setRowData] = useState<Record<string, RowData>>({})

  const [filter, setFilter] = useState<QuickFilter>('all')
  const [sort, setSort] = useState<Sort>({ k: 'dbuzz', dir: 'desc' })
  const [starred, setStarred] = useState(new Set<string>())
  const [filters, setFilters] = useState<FiltersState>({ sentiment: 'any', hasAlert: false })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filtersAnchorEl, setFiltersAnchorEl] = useState<HTMLElement | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragSrcId = useRef<string | null>(null)

  const focusedRef = useRef(false)
  const autoAddFiredRef = useRef(false)
  const isMobile = useIsMobile()

  // ── Auto-open add modal when navigated from sidebar "+" ────────────────

  useEffect(() => {
    if (!autoOpenAdd || autoAddFiredRef.current) return
    autoAddFiredRef.current = true
    Promise.resolve().then(() => setShowAddModal(true)).catch(() => {})
  }, [autoOpenAdd])

  // ── Load entries on mount ──────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/watchlist')
      if (!res.ok) throw new Error(`Failed to load watchlist: ${res.status}`)
      const data = await res.json() as { entries: WatchlistEntry[] }
      setEntries(data.entries ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load watchlist.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Defer to avoid calling setState synchronously in effect body
    Promise.resolve().then(() => loadEntries()).catch(() => {})
  }, [loadEntries])

  // ── Fetch per-row data after entries load ──────────────────────────────

  useEffect(() => {
    for (const entry of entries) {
      if (rowData[entry.entryId]) continue
      void fetchRowData(entry.symbol, entry.query).then((data) => {
        setRowData((prev) => ({ ...prev, [entry.entryId]: data }))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  // ── Initial focus ──────────────────────────────────────────────────────

  useEffect(() => {
    if (focusedRef.current || !initialFocus || entries.length === 0) return
    const match = entries.find((e) => e.symbol.toUpperCase() === initialFocus.toUpperCase())
    if (match) {
      focusedRef.current = true
      const rd = rowData[match.entryId]
      onSelectToken?.(entryToToken(match, rd))
    }
  }, [initialFocus, entries, rowData, onSelectToken])

  // ── Convert entry → Token ──────────────────────────────────────────────

  function entryToToken(entry: WatchlistEntry, rd?: RowData): Token {
    return {
      sym: entry.symbol,
      name: entry.symbol, // symbol used as name placeholder until richer data is available
      price: rd?.price ?? 0,
      d24: rd?.d24 ?? 0,
      mentions: rd?.mentions ?? 0,
      dbuzz: rd?.dbuzz ?? 0,
      sent: rd?.sent ?? 'neu',
      spark: rd?.spark ?? [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      live: rd?.live ?? false,
      entryId: entry.entryId,
      query: entry.query,
    }
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────

  const handleAdded = (entry: WatchlistEntry) => {
    setEntries((prev) => [...prev, entry])
    window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT))
  }

  const handleDelete = async (entry: WatchlistEntry) => {
    if (!window.confirm(`Remove $${entry.symbol} from your watchlist?`)) return
    // Optimistic removal
    setEntries((prev) => prev.filter((e) => e.entryId !== entry.entryId))
    if (selectedToken?.entryId === entry.entryId) onSelectToken?.(null)
    try {
      const res = await fetch(`/api/watchlist/${entry.entryId}`, { method: 'DELETE' })
      if (res.ok) {
        // DB now reflects the removal — refresh the sidebar (a pre-DELETE
        // dispatch would re-fetch stale data that still includes this entry).
        window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT))
      } else {
        // Revert on failure
        setEntries((prev) => {
          const already = prev.find((e) => e.entryId === entry.entryId)
          if (already) return prev
          return [...prev, entry].sort((a, b) => a.order - b.order)
        })
      }
    } catch {
      // Revert on network error
      setEntries((prev) => {
        const already = prev.find((e) => e.entryId === entry.entryId)
        if (already) return prev
        return [...prev, entry].sort((a, b) => a.order - b.order)
      })
    }
  }

  const reorder = async (newEntries: WatchlistEntry[]) => {
    setEntries(newEntries)
    try {
      await fetch('/api/watchlist/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newEntries.map((e) => e.entryId) }),
      })
      // Persisted — refresh the sidebar so its order matches the DB.
      window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT))
    } catch {
      // Non-fatal: the local order is still updated, reorder will resync on next load
    }
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const next = [...entries]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    void reorder(next)
  }

  const handleMoveDown = (index: number) => {
    if (index === entries.length - 1) return
    const next = [...entries]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    void reorder(next)
  }

  // ── Drag-and-drop (desktop) ────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    dragSrcId.current = entryId
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, entryId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(entryId)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const srcId = dragSrcId.current
    if (!srcId || srcId === targetId) return
    dragSrcId.current = null
    const srcIdx = entries.findIndex((e) => e.entryId === srcId)
    const tgtIdx = entries.findIndex((e) => e.entryId === targetId)
    if (srcIdx < 0 || tgtIdx < 0) return
    const next = [...entries]
    const [removed] = next.splice(srcIdx, 1)
    next.splice(tgtIdx, 0, removed)
    void reorder(next)
  }

  // ── Filtering + sorting ────────────────────────────────────────────────

  let tokens: Token[] = entries.map((e) => entryToToken(e, rowData[e.entryId]))

  // Quick filter
  if (filter === 'bull') tokens = tokens.filter((t) => t.sent === 'bull')
  if (filter === 'bear') tokens = tokens.filter((t) => t.sent === 'bear')
  if (filter === 'live') tokens = tokens.filter((t) => t.live)

  // Advanced filters
  if (filters.sentiment !== 'any') tokens = tokens.filter((t) => t.sent === filters.sentiment)
  // hasAlert filter is local-only placeholder (alert data not fetched here)

  tokens.sort((a, b) => {
    const av = a[sort.k] as number, bv = b[sort.k] as number
    if (typeof av !== 'number' || typeof bv !== 'number') return 0
    return sort.dir === 'desc' ? bv - av : av - bv
  })

  const toggleStar = (sym: string) => {
    const s = new Set(starred)
    s.has(sym) ? s.delete(sym) : s.add(sym)
    setStarred(s)
  }

  const handleOpen = (t: Token) => onSelectToken?.(selectedToken?.sym === t.sym ? null : t)

  const filtersActive = filters.sentiment !== 'any' || filters.hasAlert

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-3)', font: '500 13px var(--font-sans)' }}>
          Loading watchlist…
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--neg)', font: '500 13px var(--font-sans)' }}>
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FilterBar
        filter={filter}
        setFilter={setFilter}
        isMobile={isMobile}
        tokenCount={entries.length}
        onAddToken={() => setShowAddModal(true)}
        onFiltersOpen={(e) => { setFiltersAnchorEl(e.currentTarget); setFiltersOpen((v) => !v) }}
        filtersActive={filtersActive}
      />

      {filtersOpen && (
        <FiltersPopover
          filters={filters}
          onFiltersChange={setFilters}
          anchorEl={filtersAnchorEl}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {entries.length === 0 ? (
        <EmptyState onAddToken={() => setShowAddModal(true)} />
      ) : isMobile ? (
        // Mobile: stacked cards with ↑/↓ reorder buttons
        <div>
          {tokens.map((t, idx) => {
            const entry = entries.find((e) => e.entryId === t.entryId)
            const realIdx = entries.findIndex((e) => e.entryId === t.entryId)
            return (
              <WatchlistCard
                key={t.entryId ?? t.sym}
                t={t}
                index={realIdx}
                total={entries.length}
                starred={starred.has(t.sym)}
                onStar={() => toggleStar(t.sym)}
                onOpen={() => handleOpen(t)}
                onDelete={() => entry && void handleDelete(entry)}
                onMoveUp={() => handleMoveUp(realIdx)}
                onMoveDown={() => handleMoveDown(realIdx)}
                selected={selectedToken?.sym === t.sym}
              />
            )
          })}
        </div>
      ) : (
        // Desktop: sticky column header + grid rows with drag-and-drop
        <>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1 }}>
            <div />
            <div />
            <SortHead k="sym"   sort={sort} setSort={setSort}>Ticker</SortHead>
            <SortHead k="sym"   sort={sort} setSort={setSort}>15min · sparkline</SortHead>
            <SortHead k="price" sort={sort} setSort={setSort} align="right">Price</SortHead>
            <SortHead k="d24"   sort={sort} setSort={setSort} align="right">24h</SortHead>
            <SortHead k="dbuzz" sort={sort} setSort={setSort} align="right">Mentions · Δ buzz</SortHead>
            <div />
          </div>
          <div>
            {tokens.map((t, idx) => {
              const entry = entries.find((e) => e.entryId === t.entryId)
              const realIdx = entries.findIndex((e) => e.entryId === t.entryId)
              return (
                <WatchlistRow
                  key={t.entryId ?? t.sym}
                  t={t}
                  index={realIdx}
                  total={entries.length}
                  starred={starred.has(t.sym)}
                  onStar={() => toggleStar(t.sym)}
                  onOpen={() => handleOpen(t)}
                  onDelete={() => entry && void handleDelete(entry)}
                  onMoveUp={() => handleMoveUp(realIdx)}
                  onMoveDown={() => handleMoveDown(realIdx)}
                  selected={selectedToken?.sym === t.sym}
                  onDragStart={(e) => handleDragStart(e, t.entryId ?? t.sym)}
                  onDragOver={(e) => handleDragOver(e, t.entryId ?? t.sym)}
                  onDrop={(e) => handleDrop(e, t.entryId ?? t.sym)}
                />
              )
            })}
          </div>
        </>
      )}

      {showAddModal && (
        <AddTokenModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
