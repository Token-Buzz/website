'use client'

import { Card, SectionHead } from '../_dashboard/primitives'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { CardMenu } from '../dashboards/_components/CardMenu'
import { humDragProps } from '../_dashboard/humDragSource'
import type { HumStagedContext } from '../_dashboard/humContext'

// ── AnalyticsCardFrame ────────────────────────────────────────────────────────

interface AnalyticsCardFrameProps {
  label: string
  meta: string
  onAddToContext: () => void
  onAddToDashboard: () => void
  dragItem?: HumStagedContext
  children: React.ReactNode
}

export function AnalyticsCardFrame({
  label,
  meta,
  onAddToContext,
  onAddToDashboard,
  dragItem,
  children,
}: AnalyticsCardFrameProps) {
  const header = (
    <SectionHead
      eyebrow={label}
      meta={meta}
      action={
        <CardMenu
          actions={[
            { label: 'Add to context', onSelect: onAddToContext },
            { label: 'Add to dashboard', onSelect: onAddToDashboard },
          ]}
        />
      }
    />
  )

  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column' }}>
      {dragItem ? (
        <div {...humDragProps(dragItem)} style={{ cursor: 'grab' }}>
          {header}
        </div>
      ) : (
        header
      )}
      <ChartErrorBoundary chartName={label}>{children}</ChartErrorBoundary>
    </Card>
  )
}
