'use client'

import { Card, SectionHead } from '../_dashboard/primitives'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { CardMenu } from '../dashboards/_components/CardMenu'

// ── AnalyticsCardFrame ────────────────────────────────────────────────────────

interface AnalyticsCardFrameProps {
  label: string
  meta: string
  onAddToContext: () => void
  onAddToDashboard: () => void
  children: React.ReactNode
}

export function AnalyticsCardFrame({
  label,
  meta,
  onAddToContext,
  onAddToDashboard,
  children,
}: AnalyticsCardFrameProps) {
  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column' }}>
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
      <ChartErrorBoundary chartName={label}>{children}</ChartErrorBoundary>
    </Card>
  )
}
