'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { encodeQueryId } from '@monorepo-template/core/lib/queryId'
import type { SummaryData } from '../_analytics/SummaryProvider'
import { StaticSummaryProvider, isPopulated, DEFAULT_TIMEOUT_MS, DEFAULT_SCHEDULE_MS } from '../_analytics/SummaryProvider'
import { AnalyticsChartGrid } from '../_analytics/AnalyticsChartGrid'
import { Button, Eyebrow, Icon } from '../_dashboard/primitives'
import { DashboardPickerModal } from '../dashboards/_components/DashboardPickerModal'
import { addHumContext, buildHumContextItem, buildQueryDashboardCards } from '../dashboards/_components/cardActions'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { useUpgradeModal } from '@/app/_billing/UpgradeModalProvider'
import type { Plan } from '@monorepo-template/core/billing/tiers'

// ── Date formatter ─────────────────────────────────────────────────────────

function formatSnapshotDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// ── SnapshotView ───────────────────────────────────────────────────────────

interface SnapshotViewProps {
  query: string
  submittedAt: string
  queryHash: string
  snapshot: SummaryData
}

export function SnapshotView({ query, submittedAt, queryHash: _queryHash, snapshot }: SnapshotViewProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { openUpgrade } = useUpgradeModal()

  const [pickerCards, setPickerCards] = useState<DashboardCard[] | null>(null)
  const [pinAll, setPinAll] = useState(false)
  const [notice, setNotice] = useState<{ text: string; isError: boolean; href?: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)

  function showNotice(msg: string, isError = false, href?: string) {
    setNotice({ text: msg, isError, href })
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }

  function handleAddToContext(cardType: DashboardCardType, label: string) {
    addHumContext(buildHumContextItem({ cardType, label, query, source: 'analytics-card' }))
    showNotice('Added "' + label + '" to Hum context')
  }

  function handleAddToDashboard(cardType: DashboardCardType) {
    setPinAll(false)
    setPickerCards([{
      id: crypto.randomUUID(),
      type: cardType,
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { query },
    }])
  }

  function handlePinAll() {
    setPinAll(true)
    setPickerCards(buildQueryDashboardCards(query, () => crypto.randomUUID()))
  }

  async function handleRefresh() {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)

    try {
      // Step 1: POST /api/query
      const queryRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxPages: 5 }),
      })

      if (!queryRes.ok) {
        if (queryRes.status === 402) {
          const body = await queryRes.json().catch(() => ({})) as { used?: number; limit?: number | null; plan?: string }
          openUpgrade({ currentPlan: (body.plan ?? 'free') as Plan })
          return
        }
        if (queryRes.status === 403) {
          const body = await queryRes.json().catch(() => ({})) as { error?: string; reason?: string }
          if (body.error === 'byok_required') {
            const msg = body.reason === 'invalid'
              ? 'Your twitterapi.io API key was rejected — update it in account settings.'
              : 'Add your twitterapi.io API key to refresh this query.'
            showNotice(msg + ' → /account/api-keys', true)
            return
          }
        }
        if (queryRes.status === 429) {
          showNotice('Server is busy — please try again in a moment.', true)
          return
        }
        if (queryRes.status === 504) {
          showNotice('Search timed out — try a less broad query.', true)
          return
        }
        if (queryRes.status === 502) {
          const body = await queryRes.json().catch(() => ({})) as { detail?: string; error?: string }
          showNotice('Search failed: ' + (body.detail ?? body.error ?? `(${queryRes.status})`), true)
          return
        }
        const body = await queryRes.json().catch(() => ({})) as { error?: string }
        showNotice(body.error ?? `Request failed (${queryRes.status})`, true)
        return
      }

      // Step 2: poll summary until populated
      const deadline = Date.now() + DEFAULT_TIMEOUT_MS
      let attemptIndex = 0
      let summaryData: SummaryData | null = null

      while (true) {
        const url = `/api/analytics/summary?query=${encodeURIComponent(query)}`
        try {
          const res = await fetch(url)
          if (res.ok) {
            const json = await res.json() as SummaryData
            summaryData = json
            if (isPopulated(json)) break
          }
        } catch {
          // network error — retry
        }

        if (Date.now() >= deadline) break

        const delay = DEFAULT_SCHEDULE_MS[attemptIndex] ?? 8_000
        attemptIndex++
        await new Promise<void>((resolve) => setTimeout(resolve, delay))

        if (Date.now() >= deadline) break
      }

      if (!summaryData) {
        showNotice('Could not fetch updated data — please try again.', true)
        return
      }

      // Step 3: save the new snapshot
      const saveRes = await fetch('/api/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, snapshot: summaryData }),
      })

      if (!saveRes.ok) {
        showNotice('Data refreshed but could not save snapshot — please try again.', true)
        return
      }

      const saved = await saveRes.json() as { ok?: boolean; submittedAt?: string; queryHash?: string }

      if (!saved.submittedAt || !saved.queryHash) {
        showNotice('Unexpected response from save — please try again.', true)
        return
      }

      // Step 4: navigate to the new snapshot
      const newQueryId = encodeQueryId(saved.submittedAt, saved.queryHash)
      router.push('/history/' + encodeURIComponent(newQueryId))
    } catch {
      showNotice('Something went wrong — please try again.', true)
    } finally {
      setRefreshing(false)
      refreshingRef.current = false
    }
  }

  return (
    <div
      style={{
        padding: isMobile ? '16px 12px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 16 : 24,
        maxWidth: 1480,
        margin: '0 auto',
      }}
    >
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Eyebrow>History</Eyebrow>
          <Link
            href="/history"
            style={{
              font: '500 11px var(--font-mono)',
              color: 'var(--fg-4)',
              textDecoration: 'none',
            }}
          >
            ← Back
          </Link>
        </div>
        <h1
          style={{
            font: `600 ${isMobile ? '22px' : '28px'}/1.15 var(--font-mono)`,
            letterSpacing: '-0.015em',
            color: 'var(--fg-1)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={query}
        >
          {query}
        </h1>
      </div>

      {/* ── Snapshot banner ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--fg-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="clock" size={14} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
          <span>
            Snapshot from{' '}
            <strong style={{ color: 'var(--fg-1)' }}>{formatSnapshotDate(submittedAt)}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon="grid"
            onClick={handlePinAll}
          >
            Pin to dashboard
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* ── Notice banner ─────────────────────────────────────────────── */}
      {notice && (
        <div
          style={{
            padding: '10px 14px',
            background: notice.isError ? 'var(--bear-100, rgba(224,82,82,0.1))' : 'var(--bg-elevated)',
            border: `1px solid ${notice.isError ? 'var(--bear-500, #e05252)' : 'var(--buzz-500)'}`,
            borderRadius: 6,
            font: '500 13px/1.4 var(--font-sans)',
            color: notice.isError ? 'var(--bear-500, #e05252)' : 'var(--fg-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{notice.text}</span>
            {notice.href && (
              <Link
                href={notice.href}
                style={{
                  color: 'var(--buzz-500)',
                  textDecoration: 'none',
                  font: '500 13px/1.4 var(--font-sans)',
                  whiteSpace: 'nowrap',
                }}
              >
                View dashboard →
              </Link>
            )}
          </span>
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

      {/* ── Chart grid from snapshot data ─────────────────────────────── */}
      <StaticSummaryProvider query={query} data={snapshot}>
        <AnalyticsChartGrid
          query={query}
          isMobile={isMobile}
          selectedSource="all"
          onAddToContext={handleAddToContext}
          onAddToDashboard={handleAddToDashboard}
        />
      </StaticSummaryProvider>

      {/* ── Dashboard picker modal ────────────────────────────────────── */}
      {pickerCards !== null && (
        <DashboardPickerModal
          cards={pickerCards}
          title={pinAll ? 'Pin query to dashboard' : 'Add card to dashboard'}
          allowCreate
          createQuery={query}
          onClose={() => { setPickerCards(null); setPinAll(false) }}
          onAdded={({ dashboardId, name }) => {
            const cardCount = pickerCards?.length ?? 0
            const wasAll = pinAll
            setPickerCards(null)
            setPinAll(false)
            showNotice('Added ' + (wasAll ? cardCount + ' cards' : 'card') + ` to "${name}"`, false, `/dashboards/${dashboardId}`)
          }}
        />
      )}
    </div>
  )
}
