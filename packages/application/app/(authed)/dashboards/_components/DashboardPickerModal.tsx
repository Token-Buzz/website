'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Dashboard, DashboardCard } from '@monorepo-template/core/db/dashboards'
import { Button, Eyebrow, Icon, Ticker } from '../../_dashboard/primitives'
import { copyCardForDashboard } from './cardActions'

// ── DashboardPickerModal ──────────────────────────────────────────────────────

interface DashboardPickerModalProps {
  cards: DashboardCard[]
  currentDashboardId?: string
  title?: string
  allowCreate?: boolean
  createQuery?: string
  onClose: () => void
  onAdded: (result: { dashboardId: string; name: string }) => void
}

export function DashboardPickerModal({
  cards,
  currentDashboardId,
  title,
  allowCreate,
  createQuery,
  onClose,
  onAdded,
}: DashboardPickerModalProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fetchSeq, setFetchSeq] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [creatingName, setCreatingName] = useState(
    createQuery?.trim() ? createQuery.trim() : 'New dashboard'
  )
  const [creating, setCreating] = useState(false)

  const modalTitle = title ?? 'Add to dashboard'

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
      let acc = d.cards
      for (const c of cards) {
        const copy = copyCardForDashboard(c, acc, crypto.randomUUID())
        acc = [...acc, copy]
      }
      const res = await fetch('/api/dashboards/' + d.dashboardId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: acc }),
      })
      if (res.ok) {
        onAdded({ dashboardId: d.dashboardId, name: d.name })
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

  async function handleCreateAndAdd() {
    const name = creatingName.trim() || 'New dashboard'
    setCreating(true)
    setSaveError(null)
    try {
      // Step 1: POST /api/dashboards to create
      const createRes = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...(createQuery ? { query: createQuery } : {}) }),
      })
      if (!createRes.ok) {
        const data = (await createRes.json().catch(() => ({}))) as { error?: string }
        setSaveError(data.error ?? `Failed to create dashboard (${createRes.status}).`)
        return
      }
      const createData = (await createRes.json()) as { dashboard: Dashboard }
      const newDashboard = createData.dashboard

      // Step 2: PATCH to append all cards
      let acc = newDashboard.cards
      for (const c of cards) {
        const copy = copyCardForDashboard(c, acc, crypto.randomUUID())
        acc = [...acc, copy]
      }
      const patchRes = await fetch('/api/dashboards/' + newDashboard.dashboardId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: acc }),
      })
      if (patchRes.ok) {
        onAdded({ dashboardId: newDashboard.dashboardId, name: newDashboard.name })
      } else {
        const data = (await patchRes.json().catch(() => ({}))) as { error?: string }
        setSaveError(data.error ?? `Dashboard created but cards could not be added (${patchRes.status}).`)
      }
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const candidates = dashboards.filter((d) => d.dashboardId !== (currentDashboardId ?? ''))
  const isBusy = savingId !== null || creating

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
              {modalTitle}
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
          ) : candidates.length === 0 && !allowCreate ? (
            // Empty state — no create affordance
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
            // Dashboard list (may be empty when allowCreate is true)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.length === 0 && allowCreate ? (
                <div
                  style={{
                    font: '400 13px/1.5 var(--font-sans)',
                    color: 'var(--fg-3)',
                    marginBottom: 4,
                  }}
                >
                  {cards.length > 1 ? 'Add these cards to a dashboard.' : 'Add this card to a dashboard.'}{' '}
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
                candidates.map((d) => {
                  const isSaving = savingId === d.dashboardId
                  const isDisabled = isBusy
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
                })
              )}

              {/* Create new dashboard affordance */}
              {allowCreate && (
                showCreate ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--buzz-500)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        font: '600 13px/1.2 var(--font-sans)',
                        color: 'var(--fg-1)',
                      }}
                    >
                      New dashboard name
                    </div>
                    <input
                      type="text"
                      value={creatingName}
                      onChange={(e) => setCreatingName(e.target.value)}
                      disabled={creating}
                      placeholder="Dashboard name"
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
                        if (e.key === 'Enter' && !creating) void handleCreateAndAdd()
                        if (e.key === 'Escape') setShowCreate(false)
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={creating || !creatingName.trim()}
                        onClick={() => void handleCreateAndAdd()}
                      >
                        {creating ? 'Creating…' : 'Create & add'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={creating}
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreate(true)}
                    disabled={isBusy}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px dashed var(--border)',
                      cursor: isBusy ? 'default' : 'pointer',
                      opacity: isBusy ? 0.5 : 1,
                      font: '500 13px/1.2 var(--font-sans)',
                      color: 'var(--buzz-500)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'border-color 120ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isBusy) {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--buzz-500)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    }}
                  >
                    <Icon name="plus" size={14} />
                    Create new dashboard
                  </button>
                )
              )}

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
