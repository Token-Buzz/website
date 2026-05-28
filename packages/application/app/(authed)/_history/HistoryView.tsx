'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SavedQueryListItem } from '@monorepo-template/core/db/saved-queries'
import { groupQueriesByDate } from '@monorepo-template/core/lib/group-queries'
import { encodeQueryId } from '@monorepo-template/core/lib/queryId'
import { Button, Card, Eyebrow, Icon } from '../_dashboard/primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { DashboardPickerModal } from '../dashboards/_components/DashboardPickerModal'
import { buildQueryDashboardCards, ANALYTICS_CARD_TYPES } from '../dashboards/_components/cardActions'

// ── Timestamp formatter ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── HistoryRow ─────────────────────────────────────────────────────────────

function HistoryRow({
  item,
  isMobile,
  onPin,
}: {
  item: SavedQueryListItem
  isMobile: boolean
  onPin: (item: SavedQueryListItem) => void
}) {
  const router = useRouter()

  function handleRerun() {
    router.push('/analytics?q=' + encodeURIComponent(item.query))
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-hairline, var(--border))',
        flexDirection: isMobile ? 'column' : 'row',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Query string — links to the snapshot detail view */}
      <Link
        href={'/history/' + encodeURIComponent(encodeQueryId(item.submittedAt, item.queryHash))}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--fg-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
        title={item.query}
      >
        {item.query}
      </Link>

      {/* Timestamp */}
      <span
        style={{
          font: '500 11px/1 var(--font-mono)',
          color: 'var(--fg-4)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {formatTimestamp(item.submittedAt)}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={handleRerun}
          title="Re-run this query"
        >
          {isMobile ? undefined : 'Run'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="grid"
          onClick={() => onPin(item)}
          title="Pin to dashboard"
        >
          {isMobile ? undefined : 'Pin'}
        </Button>
      </div>
    </div>
  )
}

// ── HistoryView ────────────────────────────────────────────────────────────

interface HistoryViewProps {
  initialItems: SavedQueryListItem[]
}

export function HistoryView({ initialItems }: HistoryViewProps) {
  const isMobile = useIsMobile()
  const [pinQuery, setPinQuery] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null)

  const now = new Date().toISOString()
  const groups = groupQueriesByDate(initialItems, now)

  function handlePin(item: SavedQueryListItem) {
    setPinQuery(item.query)
  }

  function showAddedNotice(name: string, dashboardId: string) {
    setNotice({
      text: `Added ${ANALYTICS_CARD_TYPES.length} cards to "${name}"`,
      href: `/dashboards/${dashboardId}`,
    })
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }

  return (
    <div
      style={{
        padding: isMobile ? '16px 12px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 16 : 24,
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      {/* Page header */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>History</Eyebrow>
        <h1
          style={{
            font: `600 ${isMobile ? '22px' : '28px'}/1.15 var(--font-sans)`,
            letterSpacing: '-0.015em',
            color: 'var(--fg-1)',
            margin: 0,
          }}
        >
          Query history
        </h1>
      </div>

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

      {/* Empty state */}
      {groups.length === 0 ? (
        <Card padding={40} style={{ textAlign: 'center' }}>
          <div
            style={{
              font: '500 14px/1.6 var(--font-sans)',
              color: 'var(--fg-3)',
              marginBottom: 16,
            }}
          >
            No saved queries yet — run a query on Analytics and it&apos;ll show up here.
          </div>
          <Link href="/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              Go to Analytics
            </Button>
          </Link>
        </Card>
      ) : (
        /* Grouped query list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20 }}>
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <div
                style={{
                  padding: '0 4px 8px',
                }}
              >
                <Eyebrow>{group.label}</Eyebrow>
              </div>

              {/* Rows card */}
              <Card padding={0} style={{ overflow: 'hidden' }}>
                {group.items.map((item) => (
                  <HistoryRow
                    key={`${item.submittedAt}::${item.queryHash}`}
                    item={item}
                    isMobile={isMobile}
                    onPin={handlePin}
                  />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard picker modal */}
      {pinQuery !== null && (
        <DashboardPickerModal
          cards={buildQueryDashboardCards(pinQuery, () => crypto.randomUUID())}
          title="Pin query to dashboard"
          allowCreate
          createQuery={pinQuery}
          onClose={() => setPinQuery(null)}
          onAdded={({ dashboardId, name }) => {
            setPinQuery(null)
            showAddedNotice(name, dashboardId)
          }}
        />
      )}
    </div>
  )
}
