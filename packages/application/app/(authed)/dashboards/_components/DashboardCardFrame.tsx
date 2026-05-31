'use client'

import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Card, Eyebrow, Icon } from '../../_dashboard/primitives'
import { ChartErrorBoundary } from '../../_analytics/ChartErrorBoundary'
import { CardBody } from './registry'
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
  /** When present, makes the card label area a Hum drag source (only when not editing layout) */
  dragItem?: HumStagedContext
  /** Whether this card is currently selected for bulk actions */
  selected?: boolean
  /** Called when the user toggles the selection checkbox */
  onToggleSelect?: () => void
  /** When true, the card is in layout-editing mode (drag handles are shown) */
  editing?: boolean
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
  selected = false,
  onToggleSelect,
  editing = false,
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
        // Selected affordance: accent border
        ...(selected
          ? { outline: '2px solid var(--buzz-500)', outlineOffset: '-1px' }
          : {}),
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        {/* TOP-LEFT: selection checkbox */}
        <div
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
          // Prevent the checkbox click from bubbling into the drag handle span
          onPointerDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select card: ${label}`}
            style={{
              width: 14,
              height: 14,
              cursor: 'pointer',
              accentColor: 'var(--buzz-500)',
              margin: 0,
            }}
          />
        </div>

        {/* MIDDLE: label + meta (drag source when not editing layout) */}
        <div
          {...(dragItem && !editing ? humDragProps(dragItem) : {})}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            minWidth: 0,
            ...(dragItem && !editing ? { cursor: 'grab' } : {}),
          }}
        >
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

        {/* TOP-RIGHT: always-visible icon action buttons (hidden in editing mode) */}
        {!editing && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          >
            {/* Add to context */}
            <button
              onClick={onAddToContext}
              aria-label="Add to context"
              title="Add to context"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--fg-3)',
                padding: '3px 4px',
                borderRadius: 4,
                lineHeight: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-1)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-sunken)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <Icon name="sparkle" size={13} />
            </button>

            {/* Add to dashboard */}
            <button
              onClick={onAddToDashboard}
              aria-label="Add to dashboard"
              title="Add to dashboard"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--fg-3)',
                padding: '3px 4px',
                borderRadius: 4,
                lineHeight: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-1)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-sunken)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <Icon name="grid" size={13} />
            </button>

            {/* Remove from dashboard */}
            <button
              onClick={onRemove}
              aria-label="Remove from dashboard"
              title="Remove from dashboard"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--bear-500, #dc3545)',
                padding: '3px 4px',
                borderRadius: 4,
                lineHeight: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-sunken)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
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
