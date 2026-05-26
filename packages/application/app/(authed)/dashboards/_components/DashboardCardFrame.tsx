'use client'

import { useState, useEffect, useRef } from 'react'
import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Card, Eyebrow } from '../../_dashboard/primitives'
import { ChartErrorBoundary } from '../../_analytics/ChartErrorBoundary'
import { CardBody } from './registry'

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
  /** Called when the user chooses "Remove from dashboard" */
  onRemove: () => void
  /** Called when the user chooses "Add to context" (Hum M3) */
  onAddToContext: () => void
  /** Called when the user chooses "Add to dashboard" (opens picker modal) */
  onAddToDashboard: () => void
}

export function DashboardCardFrame({
  label,
  meta,
  type,
  query,
  onRemove,
  onAddToContext,
  onAddToDashboard,
}: DashboardCardFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexShrink: 0,
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

        {/* ··· menu button */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Card options"
            aria-expanded={menuOpen}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--fg-3)',
              fontSize: 16,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ⋯
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 50,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                minWidth: 180,
                overflow: 'hidden',
              }}
            >
              {/* Add to context */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onAddToContext()
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
                Add to context
              </button>

              {/* Add to dashboard */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onAddToDashboard()
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
                Add to dashboard
              </button>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

              {/* Remove from dashboard */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRemove()
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
                  color: 'var(--bear-500, #dc3545)',
                  letterSpacing: '-0.005em',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    'var(--bg-sunken)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                Remove from dashboard
              </button>
            </div>
          )}
        </div>
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
          <CardBody type={type} query={query} />
        </ChartErrorBoundary>
      </div>
    </Card>
  )
}
