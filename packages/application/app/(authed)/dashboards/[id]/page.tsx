'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Dashboard, DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Button, Eyebrow, Card, Icon, Ticker } from '../../_dashboard/primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { CARD_META, ALL_CARD_TYPES } from '../_components/registry'
import { DashboardPickerModal } from '../_components/DashboardPickerModal'
import {
  addHumContext,
  buildHumContextItem,
  resolveCardQuery,
  resolveCardSymbol,
  selectionScopeAvailability,
  applyScopeToSelectedCards,
  describeIngestResult,
} from '../_components/cardActions'
import { nextCardPosition } from '../_components/grid'
import { dashboardScopeQuery } from '../_components/scope'
import { DashboardGrid } from '../_components/DashboardGrid'

// ── AddCardMenu ───────────────────────────────────────────────────────────────

interface AddCardMenuProps {
  onAdd: (type: DashboardCardType) => void
  isMobile?: boolean
}

function AddCardMenu({ onAdd, isMobile }: AddCardMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const menuStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 12,
        top: 'auto',
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 50,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
      }
    : {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        zIndex: 50,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        minWidth: 200,
        overflow: 'hidden',
      }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <Button
        variant="primary"
        size="md"
        icon="plus"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Add card
      </Button>

      {open && (
        <div
          role="menu"
          style={menuStyle}
        >
          {ALL_CARD_TYPES.map((type) => {
            const { label } = CARD_META[type]
            return (
              <button
                key={type}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onAdd(type)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  font: '500 13px/1.2 var(--font-sans)',
                  color: 'var(--fg-1)',
                  letterSpacing: '-0.005em',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-sunken)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ScopeEditModal ────────────────────────────────────────────────────────────

interface ScopeEditModalProps {
  field: 'query' | 'ticker'
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

function ScopeEditModal({ field, initialValue, onSave, onClose }: ScopeEditModalProps) {
  const [value, setValue] = useState(initialValue)

  // Escape-to-close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const title = field === 'query' ? 'Change Query' : 'Change Ticker'
  const placeholder = field === 'query' ? 'e.g. bitcoin news' : 'e.g. BTC'
  const label = field === 'query' ? 'Query' : 'Ticker symbol'

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-edit-modal-title"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow style={{ marginBottom: 4 }}>Bulk action</Eyebrow>
            <h2
              id="scope-edit-modal-title"
              style={{
                font: '600 18px/1.2 var(--font-sans)',
                color: 'var(--fg-1)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--fg-3)',
              padding: 4,
              borderRadius: 4,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            htmlFor="scope-edit-input"
            style={{
              font: '600 13px/1.2 var(--font-sans)',
              color: 'var(--fg-1)',
            }}
          >
            {label}
          </label>
          <input
            id="scope-edit-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{
              font: '500 13px/1.2 var(--font-sans)',
              color: 'var(--fg-1)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 10px',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) onSave(value)
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="primary"
            size="sm"
            disabled={!value.trim()}
            onClick={() => onSave(value)}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── BulkToolbar ───────────────────────────────────────────────────────────────

interface BulkToolbarProps {
  selectedCount: number
  canChangeQuery: boolean
  canChangeTicker: boolean
  isMobile: boolean
  onAddToContext: () => void
  onAddToDashboard: () => void
  onRemove: () => void
  onChangeQuery: () => void
  onChangeTicker: () => void
  onClear: () => void
}

function BulkToolbar({
  selectedCount,
  canChangeQuery,
  canChangeTicker,
  isMobile,
  onAddToContext,
  onAddToDashboard,
  onRemove,
  onChangeQuery,
  onChangeTicker,
  onClear,
}: BulkToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 8,
        flexWrap: 'wrap',
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--buzz-500)',
        borderRadius: 8,
      }}
    >
      {/* Count badge */}
      <span
        style={{
          font: '600 12px/1 var(--font-sans)',
          color: 'var(--buzz-500)',
          background: 'rgba(var(--buzz-500-rgb, 255,107,44),0.1)',
          borderRadius: 4,
          padding: '4px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {selectedCount} selected
      </span>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexWrap: 'wrap' }}>
        <Button
          variant="ghost"
          size="sm"
          icon="sparkle"
          onClick={onAddToContext}
          aria-label="Add selected to context"
          title="Add to context"
        >
          {isMobile ? '' : 'Add to context'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon="grid"
          onClick={onAddToDashboard}
          aria-label="Add selected to dashboard"
          title="Add to dashboard"
        >
          {isMobile ? '' : 'Add to dashboard'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon="activity"
          onClick={onChangeQuery}
          disabled={!canChangeQuery}
          aria-label="Change query for selected cards"
          title={canChangeQuery ? 'Change query' : 'No analytics cards selected'}
          style={{
            opacity: canChangeQuery ? 1 : 0.4,
            cursor: canChangeQuery ? 'pointer' : 'not-allowed',
          }}
        >
          {isMobile ? '' : 'Change query'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon="trend"
          onClick={onChangeTicker}
          disabled={!canChangeTicker}
          aria-label="Change ticker for selected cards"
          title={canChangeTicker ? 'Change ticker' : 'No candlestick cards selected'}
          style={{
            opacity: canChangeTicker ? 1 : 0.4,
            cursor: canChangeTicker ? 'pointer' : 'not-allowed',
          }}
        >
          {isMobile ? '' : 'Change ticker'}
        </Button>

        <Button
          variant="danger"
          size="sm"
          icon="trash"
          onClick={onRemove}
          aria-label="Remove selected cards from dashboard"
          title="Remove from dashboard"
        >
          {isMobile ? '' : 'Remove'}
        </Button>
      </div>

      {/* Spacer + clear */}
      <div style={{ flex: 1 }} />
      <button
        onClick={onClear}
        aria-label="Clear selection"
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--fg-3)',
          font: '500 12px/1 var(--font-sans)',
          padding: '4px 6px',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-1)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'
        }}
      >
        <Icon name="close" size={12} />
        Clear
      </button>
    </div>
  )
}

// ── DashboardDetailPage ───────────────────────────────────────────────────────

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [pickerCards, setPickerCards] = useState<DashboardCard[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Scope edit modal state: null when closed
  const [scopeEdit, setScopeEdit] = useState<{ field: 'query' | 'ticker' } | null>(null)

  // ── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    let cancelled = false

    // Reset selection whenever the dashboard id changes (synchronous at effect start is intentional)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set())

    async function fetchDashboard() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/dashboards/${id}`)
        if (cancelled) return
        if (res.status === 404) {
          setError('Dashboard not found.')
          return
        }
        if (!res.ok) {
          setError(`Failed to load dashboard (${res.status}).`)
          return
        }
        const data = (await res.json()) as { dashboard: Dashboard }
        if (!cancelled) setDashboard(data.dashboard)
      } catch {
        if (!cancelled) setError('Network error. Could not load dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [id])

  // ── Card persistence ──────────────────────────────────────────────────────

  async function persistCards(nextCards: DashboardCard[]) {
    if (!dashboard) return

    // Optimistic update
    const prev = dashboard.cards
    setDashboard((d) => (d ? { ...d, cards: nextCards } : d))
    setPersistError(null)

    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: nextCards }),
      })

      if (!res.ok) {
        // Revert
        setDashboard((d) => (d ? { ...d, cards: prev } : d))
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setPersistError(data.error ?? `Save failed (${res.status}).`)
      } else {
        const data = (await res.json()) as { dashboard: Dashboard }
        // Sync with the server-returned dashboard (authoritative)
        setDashboard(data.dashboard)
      }
    } catch {
      // Revert on network error
      setDashboard((d) => (d ? { ...d, cards: prev } : d))
      setPersistError('Network error. Changes could not be saved.')
    }
  }

  // ── Auto-dismiss notice ───────────────────────────────────────────────────

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelect(cardId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ── Per-card event handlers ───────────────────────────────────────────────

  function handleAddCard(type: DashboardCardType) {
    if (!dashboard) return
    const newCard: DashboardCard = {
      id: crypto.randomUUID(),
      type,
      position: nextCardPosition(dashboard.cards),
      options: {},
    }
    void persistCards([...dashboard.cards, newCard])
  }

  function handleRemoveCard(cardId: string) {
    if (!dashboard) return
    void persistCards(dashboard.cards.filter((c) => c.id !== cardId))
  }

  function handleAddToContext(card: DashboardCard) {
    if (!dashboard) return
    const label = CARD_META[card.type]?.label ?? card.type
    // Use per-card resolved query/symbol, not the dashboard-wide defaults
    addHumContext(
      buildHumContextItem({
        cardType: card.type,
        label,
        query: resolveCardQuery(card, dashboard),
        ticker: resolveCardSymbol(card, dashboard) || undefined,
      }),
    )
    setNotice('Added "' + label + '" to Hum context')
  }

  function handleAddToDashboard(card: DashboardCard) {
    setPickerCards([card])
  }

  // ── Bulk action handlers ──────────────────────────────────────────────────

  function handleBulkRemove() {
    if (!dashboard) return
    void persistCards(dashboard.cards.filter((c) => !selectedIds.has(c.id)))
    clearSelection()
  }

  function handleBulkAddToContext() {
    if (!dashboard) return
    for (const card of dashboard.cards) {
      if (!selectedIds.has(card.id)) continue
      const label = CARD_META[card.type]?.label ?? card.type
      addHumContext(
        buildHumContextItem({
          cardType: card.type,
          label,
          query: resolveCardQuery(card, dashboard),
          ticker: resolveCardSymbol(card, dashboard) || undefined,
        }),
      )
    }
    setNotice(`Added ${selectedIds.size} card${selectedIds.size > 1 ? 's' : ''} to Hum context`)
    clearSelection()
  }

  function handleBulkAddToDashboard() {
    if (!dashboard) return
    const cards = dashboard.cards.filter((c) => selectedIds.has(c.id))
    setPickerCards(cards)
  }

  // ── Ingestion helper ──────────────────────────────────────────────────────

  async function ingestQuery(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55_000)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, maxPages: 5 }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        const { message } = describeIngestResult(res.status, body)
        setNotice(message)
        return
      }

      setNotice(`Fetching data for "${trimmed}" — charts will update shortly.`)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setNotice(`Could not fetch data for "${trimmed}": request timed out.`)
      } else {
        setNotice(`Could not fetch data for "${trimmed}": network error.`)
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function handleBulkScopeApply(field: 'query' | 'ticker', value: string) {
    if (!dashboard) return
    const updated = applyScopeToSelectedCards(dashboard.cards, selectedIds, field, value)
    void persistCards(updated)
    setScopeEdit(null)
    clearSelection()
    if (field === 'query' && value.trim()) {
      void ingestQuery(value)
    }
  }

  function handleCardScopeApply(cardId: string, field: 'query' | 'ticker', value: string) {
    if (!dashboard) return
    void persistCards(applyScopeToSelectedCards(dashboard.cards, [cardId], field, value))
    if (field === 'query' && value.trim()) {
      void ingestQuery(value)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const wrapperStyle: React.CSSProperties = {
    padding: isMobile ? '16px 12px' : '24px',
    maxWidth: 1480,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? 16 : 24,
  }

  // Loading skeleton
  if (loading) {
    return (
      <div style={wrapperStyle}>
        {/* Back link */}
        <Link
          href="/dashboards"
          style={{
            font: '500 13px/1 var(--font-sans)',
            color: 'var(--fg-3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name="chevR" size={14} style={{ transform: 'rotate(180deg)' }} />
          Dashboards
        </Link>
        {/* Skeleton bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[240, 320, 100].map((w, i) => (
            <div
              key={i}
              style={{
                height: i === 0 ? 32 : i === 1 ? 20 : 16,
                width: w,
                maxWidth: '100%',
                borderRadius: 6,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Error / not found state
  if (error) {
    return (
      <div style={wrapperStyle}>
        <Link
          href="/dashboards"
          style={{
            font: '500 13px/1 var(--font-sans)',
            color: 'var(--fg-3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name="chevR" size={14} style={{ transform: 'rotate(180deg)' }} />
          Dashboards
        </Link>
        <Card padding={isMobile ? 24 : 40} style={{ textAlign: 'center' }}>
          <div
            style={{
              font: '600 14px var(--font-sans)',
              color: 'var(--bear-500, #dc3545)',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
          <Link
            href="/dashboards"
            style={{
              font: '500 13px/1 var(--font-sans)',
              color: 'var(--buzz-500)',
              textDecoration: 'none',
            }}
          >
            ← Back to dashboards
          </Link>
        </Card>
      </div>
    )
  }

  if (!dashboard) return null

  const scopeQuery = dashboardScopeQuery(dashboard)
  const { cards } = dashboard

  // Derive toolbar availability from the selected cards
  const selectedCards = cards.filter((c) => selectedIds.has(c.id))
  const { canChangeQuery, canChangeTicker } = selectionScopeAvailability(selectedCards)

  // Pre-fill for single-card scope edits
  const singleSelectedCard = selectedCards.length === 1 ? selectedCards[0] : null
  const scopeEditInitialValue =
    scopeEdit && singleSelectedCard
      ? scopeEdit.field === 'query'
        ? (typeof singleSelectedCard.options.query === 'string' ? singleSelectedCard.options.query : '')
        : (typeof singleSelectedCard.options.ticker === 'string' ? singleSelectedCard.options.ticker : '')
      : ''

  return (
    <div style={wrapperStyle}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 14 : 0,
        }}
      >
        {/* Left: back + title + scope chips */}
        <div style={{ flex: 1 }}>
          <Link
            href="/dashboards"
            style={{
              font: '500 13px/1 var(--font-sans)',
              color: 'var(--fg-3)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 10,
            }}
          >
            <Icon name="chevR" size={14} style={{ transform: 'rotate(180deg)' }} />
            Dashboards
          </Link>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1
              style={{
                font: `600 ${isMobile ? '22px' : '28px'}/1.15 var(--font-sans)`,
                letterSpacing: '-0.015em',
                color: 'var(--fg-1)',
                margin: 0,
              }}
            >
              {dashboard.name}
            </h1>
            {/* Scope chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {dashboard.ticker && <Ticker symbol={dashboard.ticker} size="sm" />}
              {dashboard.query && (
                <span
                  style={{
                    font: '500 12px/1 var(--font-mono)',
                    color: 'var(--fg-2)',
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dashboard.query}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: edit layout toggle + add card */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!isMobile && cards.length > 0 && (
            editing ? (
              <Button variant="primary" size="md" icon="grid" onClick={() => setEditing(false)}>
                Done
              </Button>
            ) : (
              <Button variant="secondary" size="md" icon="grid" onClick={() => setEditing(true)}>
                Edit layout
              </Button>
            )
          )}
          <AddCardMenu onAdd={handleAddCard} isMobile={isMobile} />
        </div>
      </div>

      {/* Persist error banner */}
      {persistError && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bear-100, rgba(220,53,69,0.1))',
            border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
            borderRadius: 6,
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--bear-500, #dc3545)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{persistError}</span>
          <button
            onClick={() => setPersistError(null)}
            aria-label="Dismiss"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              padding: 2,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Notice banner */}
      {notice && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--buzz-500)',
            borderRadius: 6,
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--fg-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              padding: 2,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* ── Bulk action toolbar (shown when ≥1 card selected) ───────────── */}
      {selectedIds.size > 0 && (
        <BulkToolbar
          selectedCount={selectedIds.size}
          canChangeQuery={canChangeQuery}
          canChangeTicker={canChangeTicker}
          isMobile={isMobile}
          onAddToContext={handleBulkAddToContext}
          onAddToDashboard={handleBulkAddToDashboard}
          onRemove={handleBulkRemove}
          onChangeQuery={() => setScopeEdit({ field: 'query' })}
          onChangeTicker={() => setScopeEdit({ field: 'ticker' })}
          onClear={clearSelection}
        />
      )}

      {/* ── Grid / Empty state ──────────────────────────────────────────── */}
      {cards.length === 0 ? (
        // Empty state
        <Card
          padding={isMobile ? 32 : 56}
          style={{ textAlign: 'center' }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              color: 'var(--fg-3)',
            }}
          >
            <Icon name="grid" size={24} />
          </div>
          <div
            style={{
              font: '600 16px/1.3 var(--font-sans)',
              color: 'var(--fg-1)',
              marginBottom: 8,
              letterSpacing: '-0.01em',
            }}
          >
            No cards yet
          </div>
          <div
            style={{
              font: '400 13px/1.5 var(--font-sans)',
              color: 'var(--fg-3)',
              marginBottom: 20,
              maxWidth: 340,
              margin: '0 auto 20px',
            }}
          >
            Add your first card to start building your dashboard.
          </div>
          <AddCardMenu onAdd={handleAddCard} isMobile={isMobile} />
        </Card>
      ) : (
        // Per-card SummaryProviders are created inside DashboardGrid;
        // the query/ticker props here serve as dashboard-level fallback values.
        <DashboardGrid
          cards={cards}
          query={scopeQuery}
          editing={editing}
          isMobile={isMobile}
          ticker={dashboard.ticker}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onLayoutChange={persistCards}
          onRemoveCard={handleRemoveCard}
          onAddToContext={handleAddToContext}
          onAddToDashboard={handleAddToDashboard}
          onChangeCardScope={handleCardScopeApply}
        />
      )}

      {/* Picker modal — "Add to dashboard" */}
      {pickerCards && dashboard && (
        <DashboardPickerModal
          cards={pickerCards}
          currentDashboardId={dashboard.dashboardId}
          onClose={() => setPickerCards(null)}
          onAdded={({ name }) => {
            setPickerCards(null)
            const count = pickerCards.length
            setNotice(
              count > 1
                ? `Added ${count} cards to "${name}"`
                : 'Added card to "' + name + '"',
            )
            clearSelection()
          }}
        />
      )}

      {/* Scope edit modal — Change Query / Change Ticker */}
      {scopeEdit && (
        <ScopeEditModal
          field={scopeEdit.field}
          initialValue={scopeEditInitialValue}
          onSave={(value) => handleBulkScopeApply(scopeEdit.field, value)}
          onClose={() => setScopeEdit(null)}
        />
      )}
    </div>
  )
}
