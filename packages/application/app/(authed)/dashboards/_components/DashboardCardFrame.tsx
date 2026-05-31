'use client'

import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Card, Eyebrow } from '../../_dashboard/primitives'
import { ChartErrorBoundary } from '../../_analytics/ChartErrorBoundary'
import { CardBody } from './registry'
import { CardMenu } from './CardMenu'
import { humDragProps } from '../../_dashboard/humDragSource'
import type { HumStagedContext } from '../../_dashboard/humContext'

// ── DashboardCardFrame ────────────────────────────────────────────────────────

interface DashboardCardFrameProps {
  /** Eyebrow label for the card header */
  label: string
  /** Small meta string shown next to the label */
  meta: string
  /** Card type, forwarded to CardBody */
  type: DashboardCardType
  /** Scope query derived from the dashboard, forwarded to the chart */
  query: string
  /** Dashboard ticker, forwarded to CardBody for candlestick symbol resolution */
  ticker?: string
  /** Called when the user chooses "Remove from dashboard" */
  onRemove: () => void
  /** Called when the user chooses "Add to context" (Hum M3) */
  onAddToContext: () => void
  /** Called when the user chooses "Add to dashboard" (opens picker modal) */
  onAddToDashboard: () => void
  /** When present, makes the card header a Hum drag source (only when not editing layout) */
  dragItem?: HumStagedContext
}

export function DashboardCardFrame({
  label,
  meta,
  type,
  query,
  ticker,
  onRemove,
  onAddToContext,
  onAddToDashboard,
  dragItem,
}: DashboardCardFrameProps) {
  return (
    <Card
      padding={16}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        {...(dragItem ? humDragProps(dragItem) : {})}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexShrink: 0,
          ...(dragItem ? { cursor: 'grab' } : {}),
        }}
      >
        {/* Label + meta */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <Eyebrow style={{ flexShrink: 0 }}>{label}</Eyebrow>
          <span
            style={{
              font: '500 11px/1 var(--font-mono)',
              color: 'var(--fg-3)',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {meta}
          </span>
        </div>

        {/* ··· menu */}
        <CardMenu
          actions={[
            { label: 'Add to context', onSelect: onAddToContext },
            { label: 'Add to dashboard', onSelect: onAddToDashboard },
            { label: 'Remove from dashboard', onSelect: onRemove, danger: true },
          ]}
        />
      </div>

      {/* Chart body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <ChartErrorBoundary chartName={label}>
          <CardBody type={type} query={query} ticker={ticker} />
        </ChartErrorBoundary>
      </div>
    </Card>
  )
}
