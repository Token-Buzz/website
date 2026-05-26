'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Dashboard, DashboardCard } from '@monorepo-template/core/db/dashboards'
import { Button, Eyebrow, Icon, Ticker } from '../../_dashboard/primitives'
import { copyCardForDashboard } from './cardActions'

// ── DashboardPickerModal ──────────────────────────────────────────────────────

interface DashboardPickerModalProps {
  card: DashboardCard
  currentDashboardId: string
  onClose: () => void
  onAdded: (dashboardName: string) => void
}

export function DashboardPickerModal({
  card,
  currentDashboardId,
  onClose,
  onAdded,
}: DashboardPickerModalProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fetchSeq, setFetchSeq] = useState(0)

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

  // Fetch dashboards
  useEffect(() => {
    let cancelled = false

    async function fetchDashboards() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch('/api/dashboards')
        if (cancelled) return
        if (!res.ok) {
          if (!cancelled) setLoadError(`Failed to load dashboards (${res.status}).`)
          return
        }
        const data = (await res.json()) as { dashboards: Dashboard[] }
        if (!cancelled) setDashboards(data.dashboards ?? [])
      } catch {
        if (!cancelled) setLoadError('Network error. Could not load dashboards.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDashboards()
    return () => {
      cancelled = true
    }
  }, [fetchSeq])

  async function handlePickDashboard(d: Dashboard) {
    setSaveError(null)
    setSavingId(d.dashboardId)
    try {
      const copied = copyCardForDashboard(card, d.cards, crypto.randomUUID())
      const res = await fetch('/api/dashboards/' + d.dashboardId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: [...d.cards, copied] }),
      })
      if (res.ok) {
        onAdded(d.name)
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setSaveError(data.error ?? `Failed to add (${res.status}).`)
      }
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const candidates = dashboards.filter((d) => d.dashboardId !== currentDashboardId)

  return (
    // Backdrop
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
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-modal-title"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
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
            <Eyebrow style={{ marginBottom: 4 }}>Dashboards</Eyebrow>
            <h2
              id="picker-modal-title"
              style={{
                font: '600 18px/1.2 var(--font-sans)',
                color: 'var(--fg-1)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              Add to dashboard
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

        {/* Body */}
        <div>
          {loading ? (
            // Skeleton loading bars
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 52,
                    borderRadius: 8,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          ) : loadError ? (
            // Load error
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bear-100, rgba(220,53,69,0.1))',
                  border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
                  borderRadius: 6,
                  font: '500 13px/1.4 var(--font-sans)',
                  color: 'var(--bear-500, #dc3545)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {loadError}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFetchSeq((n) => n + 1)}>
                Retry
              </Button>
            </div>
          ) : candidates.length === 0 ? (
            // Empty state
            <div
              style={{
                font: '400 13px/1.5 var(--font-sans)',
                color: 'var(--fg-3)',
              }}
            >
              No other dashboards to add this card to.{' '}
              <Link
                href="/dashboards"
                style={{
                  color: 'var(--buzz-500)',
                  textDecoration: 'none',
                }}
              >
                Manage dashboards →
              </Link>
            </div>
          ) : (
            // Dashboard list
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((d) => {
                const isSaving = savingId === d.dashboardId
                const isDisabled = savingId !== null
                return (
                  <button
                    key={d.dashboardId}
                    onClick={() => handlePickDashboard(d)}
                    disabled={isDisabled}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      cursor: isDisabled ? 'default' : 'pointer',
                      opacity: isDisabled && !isSaving ? 0.5 : 1,
                      transition: 'border-color 120ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                          'var(--buzz-500)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    }}
                  >
                    {/* Dashboard name */}
                    <div
                      style={{
                        font: '600 14px/1.2 var(--font-sans)',
                        color: 'var(--fg-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}
                    >
                      {d.name}
                      {isSaving && (
                        <span
                          style={{
                            font: '400 12px/1.2 var(--font-sans)',
                            color: 'var(--fg-3)',
                            marginLeft: 8,
                          }}
                        >
                          Adding…
                        </span>
                      )}
                    </div>
                    {/* Scope chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {d.ticker && <Ticker symbol={d.ticker} size="sm" />}
                      {d.query && (
                        <span
                          style={{
                            font: '400 12px/1.2 var(--font-sans)',
                            color: 'var(--fg-3)',
                          }}
                        >
                          {d.query}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Save error */}
              {saveError && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bear-100, rgba(220,53,69,0.1))',
                    border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
                    borderRadius: 6,
                    font: '500 13px/1.4 var(--font-sans)',
                    color: 'var(--bear-500, #dc3545)',
                  }}
                >
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
