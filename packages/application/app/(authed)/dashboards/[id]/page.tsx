'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Dashboard, DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Button, Eyebrow, Card, Icon, Ticker } from '../../_dashboard/primitives'
import { SummaryProvider } from '../../_analytics/SummaryProvider'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { CARD_META, ALL_CARD_TYPES } from '../_components/registry'
import { DashboardCardFrame } from '../_components/DashboardCardFrame'
import { DashboardPickerModal } from '../_components/DashboardPickerModal'
import { addHumContext, buildHumContextItem } from '../_components/cardActions'
import { cardGridStyle, nextCardPosition, ROW_HEIGHT_PX } from '../_components/grid'
import { dashboardScopeQuery } from '../_components/scope'

// ── AddCardMenu ───────────────────────────────────────────────────────────────

interface AddCardMenuProps {
  onAdd: (type: DashboardCardType) => void
}

function AddCardMenu({ onAdd }: AddCardMenuProps) {
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
          style={{
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
          }}
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

// ── DashboardDetailPage ───────────────────────────────────────────────────────

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [pickerCard, setPickerCard] = useState<DashboardCard | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // ── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    let cancelled = false

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

  // ── Event handlers ────────────────────────────────────────────────────────

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
    addHumContext(
      buildHumContextItem({
        cardType: card.type,
        label,
        query: dashboardScopeQuery(dashboard),
        ticker: dashboard.ticker,
      }),
    )
    setNotice('Added "' + label + '" to Hum context')
  }

  function handleAddToDashboard(card: DashboardCard) {
    setPickerCard(card)
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

        {/* Right: add card */}
        <AddCardMenu onAdd={handleAddCard} />
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
          <AddCardMenu onAdd={handleAddCard} />
        </Card>
      ) : (
        // Card grid wrapped in SummaryProvider
        <SummaryProvider query={scopeQuery}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
              gridAutoRows: `${ROW_HEIGHT_PX}px`,
              gap: isMobile ? 12 : 16,
            }}
          >
            {cards.map((card) => {
              const { label, meta } = CARD_META[card.type] ?? {
                label: card.type,
                meta: '',
              }
              const gridStyle: React.CSSProperties = isMobile
                ? { gridColumn: '1 / -1', gridRow: `span ${card.position.h}` }
                : cardGridStyle(card.position)

              return (
                <div key={card.id} style={gridStyle}>
                  <DashboardCardFrame
                    label={label}
                    meta={meta}
                    type={card.type}
                    query={scopeQuery}
                    onRemove={() => handleRemoveCard(card.id)}
                    onAddToContext={() => handleAddToContext(card)}
                    onAddToDashboard={() => handleAddToDashboard(card)}
                  />
                </div>
              )
            })}
          </div>
        </SummaryProvider>
      )}

      {/* Picker modal — "Add to dashboard" */}
      {pickerCard && dashboard && (
        <DashboardPickerModal
          card={pickerCard}
          currentDashboardId={dashboard.dashboardId}
          onClose={() => setPickerCard(null)}
          onAdded={(name) => {
            setPickerCard(null)
            setNotice('Added card to "' + name + '"')
          }}
        />
      )}
    </div>
  )
}
