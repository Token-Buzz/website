'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Eyebrow, Card, Icon, Ticker } from '../_dashboard/primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Dashboard } from '@monorepo-template/core/db/dashboards'
import { suggestQueryForTicker } from '@monorepo-template/core/lib/watchlist-query'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── CreateDashboardModal ───────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreated: (dashboard: Dashboard) => void
}

function CreateDashboardModal({ onClose, onCreated }: CreateModalProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleTickerChange(val: string) {
    setTicker(val)
    if (val.trim().length > 0) {
      try {
        setQuery(suggestQueryForTicker(val))
      } catch {
        // ignore if ticker is partially typed
      }
    } else {
      setQuery('')
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Body scroll lock while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side validation mirroring API
    const trimmedName = name.trim()
    const trimmedTicker = ticker.trim()
    const trimmedQuery = query.trim()

    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    if (!trimmedTicker && !trimmedQuery) {
      setError('At least one of ticker or query is required.')
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, string> = { name: trimmedName }
      if (trimmedTicker) body.ticker = trimmedTicker
      if (trimmedQuery) body.query = trimmedQuery

      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json() as { dashboard?: Dashboard; error?: string }

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}: ${res.statusText}`)
        return
      }

      if (!data.dashboard) {
        setError('Unexpected response from server.')
        return
      }

      onCreated(data.dashboard)
      router.push(`/dashboards/${data.dashboard.dashboardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    font: '500 14px var(--font-mono)',
    color: 'var(--fg-1)',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    font: '600 12px/1.2 var(--font-sans)',
    color: 'var(--fg-2)',
    marginBottom: 6,
    letterSpacing: '-0.005em',
  }

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
        aria-labelledby="create-dashboard-title"
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
              id="create-dashboard-title"
              style={{
                font: '600 18px/1.2 var(--font-sans)',
                color: 'var(--fg-1)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              New dashboard
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label htmlFor="dashboard-name" style={labelStyle}>
              Name <span style={{ color: 'var(--bear-500)' }}>*</span>
            </label>
            <input
              id="dashboard-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Memecoins overview"
              style={inputStyle}
              autoFocus
              disabled={submitting}
            />
          </div>

          {/* Ticker + Query — at least one required */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="dashboard-ticker" style={labelStyle}>Ticker</label>
              <input
                id="dashboard-ticker"
                type="text"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="e.g. PEPE"
                style={inputStyle}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="dashboard-query" style={labelStyle}>Query</label>
              <input
                id="dashboard-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. $PEPE OR #PEPE"
                style={{ ...inputStyle, font: '500 13px var(--font-mono)' }}
                disabled={submitting}
              />
              <span style={{ font: '400 11px var(--font-sans)', color: 'var(--fg-4)' }}>
                Auto-filled from symbol. Edit freely.
              </span>
            </div>
            <p style={{
              margin: 0,
              font: '400 12px/1.4 var(--font-sans)',
              color: 'var(--fg-3)',
            }}>
              At least one of <strong>ticker</strong> or <strong>query</strong> is required.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--bear-100, rgba(220,53,69,0.1))',
              border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
              borderRadius: 6,
              font: '500 13px/1.4 var(--font-sans)',
              color: 'var(--bear-500, #dc3545)',
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon="grid"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create dashboard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DashboardRow ──────────────────────────────────────────────────────────

interface DashboardRowProps {
  dashboard: Dashboard
  onDelete: (id: string) => void
  isMobile: boolean
}

function DashboardRow({ dashboard, onDelete, isMobile }: DashboardRowProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const confirmed = window.confirm(`Delete "${dashboard.name}"? This cannot be undone.`)
    if (!confirmed) return

    setDeleting(true)
    try {
      await fetch(`/api/dashboards/${dashboard.dashboardId}`, { method: 'DELETE' })
      onDelete(dashboard.dashboardId)
    } catch {
      // If network fails, still remove from local state — the refetch will reconcile
      onDelete(dashboard.dashboardId)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Link
      href={`/dashboards/${dashboard.dashboardId}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 10 : 16,
          padding: isMobile ? '12px 14px' : '14px 20px',
          borderRadius: 8,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'border-color 120ms, box-shadow 120ms',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border-strong, var(--buzz-500))'
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border)'
          el.style.boxShadow = 'none'
        }}
      >
        {/* Icon */}
        <div style={{
          width: isMobile ? 32 : 40,
          height: isMobile ? 32 : 40,
          borderRadius: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: 'var(--fg-3)',
        }}>
          <Icon name="grid" size={isMobile ? 14 : 18} />
        </div>

        {/* Name + scope */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: `600 ${isMobile ? 13 : 14}px/1.2 var(--font-sans)`,
            color: 'var(--fg-1)',
            letterSpacing: '-0.01em',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {dashboard.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {dashboard.ticker && (
              <Ticker symbol={dashboard.ticker} size="sm" />
            )}
            {dashboard.query && (
              <span style={{
                font: '400 12px/1.2 var(--font-sans)',
                color: 'var(--fg-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: isMobile ? 140 : 280,
              }}>
                {dashboard.query}
              </span>
            )}
          </div>
        </div>

        {/* Updated at */}
        {!isMobile && (
          <div style={{
            font: '500 12px/1 var(--font-mono)',
            color: 'var(--fg-3)',
            flexShrink: 0,
            letterSpacing: '-0.01em',
          }}>
            {fmtRelative(dashboard.updatedAt)}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete ${dashboard.name}`}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: deleting ? 'not-allowed' : 'pointer',
            color: 'var(--fg-3)',
            padding: 6,
            borderRadius: 4,
            lineHeight: 0,
            flexShrink: 0,
            opacity: deleting ? 0.4 : 1,
            transition: 'color 120ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--bear-500, #dc3545)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)' }}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </Link>
  )
}

// ── DashboardsPage ────────────────────────────────────────────────────────

export default function DashboardsPage() {
  const isMobile = useIsMobile()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Incrementing this triggers a fresh fetch (used by the Retry button).
  const [fetchSeq, setFetchSeq] = useState(0)

  // Deep-link: ?new=1 auto-opens the create modal (e.g. from the command palette)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('new')) {
      params.delete('new')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
      queueMicrotask(() => setShowCreate(true))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchDashboards() {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch('/api/dashboards')
        if (!res.ok) {
          if (!cancelled) setFetchError(`Failed to load dashboards (${res.status}).`)
          return
        }
        const data = await res.json() as { dashboards?: Dashboard[] }
        if (!cancelled) setDashboards(data.dashboards ?? [])
      } catch {
        if (!cancelled) setFetchError('Network error. Could not load dashboards.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDashboards()
    return () => { cancelled = true }
  }, [fetchSeq])

  function handleDelete(id: string) {
    setDashboards((prev) => prev.filter((d) => d.dashboardId !== id))
  }

  function handleCreated(dashboard: Dashboard) {
    setDashboards((prev) => [dashboard, ...prev])
    setShowCreate(false)
  }

  return (
    <>
      <div style={{ padding: isMobile ? '16px 12px' : '24px', maxWidth: 900, margin: '0 auto' }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 14 : 0,
          marginBottom: 24,
        }}>
          <div style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Dashboards</Eyebrow>
            <h1 style={{
              font: `600 ${isMobile ? 22 : 28}px/1.15 var(--font-sans)`,
              letterSpacing: '-0.015em',
              color: 'var(--fg-1)',
              margin: 0,
            }}>
              My dashboards
            </h1>
          </div>
          <Button
            variant="primary"
            size={isMobile ? 'sm' : 'md'}
            icon="plus"
            onClick={() => setShowCreate(true)}
          >
            New dashboard
          </Button>
        </div>

        {/* Body */}
        {loading ? (
          // Loading state
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: isMobile ? 60 : 72,
                  borderRadius: 8,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        ) : fetchError ? (
          // Error state
          <Card padding={isMobile ? 24 : 40} style={{ textAlign: 'center' }}>
            <div style={{
              font: '600 14px var(--font-sans)',
              color: 'var(--bear-500, #dc3545)',
              marginBottom: 8,
            }}>
              {fetchError}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFetchSeq((n) => n + 1)}>
              Retry
            </Button>
          </Card>
        ) : dashboards.length === 0 ? (
          // Empty state
          <Card padding={isMobile ? 32 : 56} style={{ textAlign: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              color: 'var(--fg-3)',
            }}>
              <Icon name="grid" size={24} />
            </div>
            <div style={{
              font: '600 16px/1.3 var(--font-sans)',
              color: 'var(--fg-1)',
              marginBottom: 8,
              letterSpacing: '-0.01em',
            }}>
              No dashboards yet
            </div>
            <div style={{
              font: '400 13px/1.5 var(--font-sans)',
              color: 'var(--fg-3)',
              marginBottom: 20,
              maxWidth: 320,
              margin: '0 auto 20px',
            }}>
              Dashboards let you track a token or topic across sentiment, mentions, and more — all in one view.
            </div>
            <Button
              variant="primary"
              size="md"
              icon="plus"
              onClick={() => setShowCreate(true)}
            >
              Create your first dashboard
            </Button>
          </Card>
        ) : (
          // Dashboard list
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column headers — desktop only */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 20px 8px',
                font: '500 11px/1 var(--font-sans)',
                color: 'var(--fg-3)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                <div style={{ width: 40, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>Name &amp; scope</div>
                <div style={{ flexShrink: 0, width: 80, textAlign: 'right' }}>Updated</div>
                <div style={{ width: 26, flexShrink: 0 }} />
              </div>
            )}
            {dashboards.map((d) => (
              <DashboardRow
                key={d.dashboardId}
                dashboard={d}
                onDelete={handleDelete}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateDashboardModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
