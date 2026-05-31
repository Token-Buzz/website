'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { Button, Card, Eyebrow, Icon } from '../../_dashboard/primitives'
import { ChartErrorBoundary } from '../../_analytics/ChartErrorBoundary'
import { CardBody } from './registry'
import { humDragProps } from '../../_dashboard/humDragSource'
import type { HumStagedContext } from '../../_dashboard/humContext'

// ── ScopePopover ──────────────────────────────────────────────────────────────

interface PopoverPosition {
  top: number
  left: number
}

interface ScopePopoverProps {
  scopeField: 'query' | 'ticker'
  initialValue: string
  position: PopoverPosition
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onApply: (value: string) => void
  onClose: () => void
}

function ScopePopover({
  scopeField,
  initialValue,
  position,
  triggerRef,
  onApply,
  onClose,
}: ScopePopoverProps) {
  const [value, setValue] = useState(initialValue)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on outside mousedown (outside both popover and trigger)
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose, triggerRef])

  // Close on scroll or resize (simplest: close it)
  useEffect(() => {
    function handleClose() {
      onClose()
    }
    window.addEventListener('scroll', handleClose, { capture: true, passive: true })
    window.addEventListener('resize', handleClose, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleClose, { capture: true })
      window.removeEventListener('resize', handleClose)
    }
  }, [onClose])

  function handleApply() {
    if (!value.trim()) return
    onApply(value.trim())
    onClose()
  }

  const label = scopeField === 'query' ? 'Query' : 'Ticker symbol'
  const placeholder = scopeField === 'query' ? 'e.g. bitcoin news' : 'e.g. BTC'

  const panel = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Edit ${label}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        padding: 14,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Label */}
      <label
        htmlFor="scope-popover-input"
        style={{
          font: '600 11px/1 var(--font-sans)',
          color: 'var(--fg-2)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>

      {/* Input */}
      <input
        ref={inputRef}
        id="scope-popover-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        style={{
          font: '500 13px/1.2 var(--font-sans)',
          color: 'var(--fg-1)',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '7px 9px',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) handleApply()
        }}
      />

      {/* Apply button */}
      <Button
        variant="primary"
        size="sm"
        disabled={!value.trim()}
        onClick={handleApply}
      >
        APPLY
      </Button>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(panel, document.body)
}

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
  /** Which field this card uses for its scope ('query' for analytics, 'ticker' for candlestick) */
  scopeField: 'query' | 'ticker'
  /** The resolved scope value to display and pre-fill in the popover */
  scopeValue: string
  /** Called when the user applies a new scope value from the popover */
  onApplyScope: (value: string) => void
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
  scopeField,
  scopeValue,
  onApplyScope,
}: DashboardCardFrameProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<PopoverPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleTriggerClick = useCallback(() => {
    if (popoverOpen) {
      setPopoverOpen(false)
      return
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPopoverPos({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      })
    }
    setPopoverOpen(true)
  }, [popoverOpen])

  const handleClose = useCallback(() => {
    setPopoverOpen(false)
  }, [])

  // Scope trigger label
  const triggerLabel =
    scopeValue.trim()
      ? scopeField === 'ticker'
        ? `$${scopeValue}`
        : scopeValue
      : scopeField === 'ticker'
        ? 'Set ticker'
        : 'Set query'

  const isEmpty = !scopeValue.trim()

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
          marginBottom: 8,
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

      {/* Scope trigger row — centered pill button under the header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 8,
          flexShrink: 0,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
      >
        <button
          ref={triggerRef}
          onClick={handleTriggerClick}
          aria-label={`Edit ${scopeField === 'ticker' ? 'ticker' : 'query'}: ${triggerLabel}`}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          style={{
            background: 'var(--bg-sunken)',
            border: `1px solid ${popoverOpen ? 'var(--buzz-500)' : 'var(--border)'}`,
            borderRadius: 20,
            padding: '3px 10px',
            font: '500 11px/1.4 var(--font-mono)',
            color: isEmpty ? 'var(--fg-3)' : 'var(--fg-1)',
            cursor: 'pointer',
            maxWidth: '80%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!popoverOpen) {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--buzz-500)'
            }
          }}
          onMouseLeave={(e) => {
            if (!popoverOpen) {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
            }
          }}
        >
          {triggerLabel}
        </button>
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

      {/* Scope popover (portaled to document.body) */}
      {popoverOpen && (
        <ScopePopover
          scopeField={scopeField}
          initialValue={scopeValue}
          position={popoverPos}
          triggerRef={triggerRef}
          onApply={onApplyScope}
          onClose={handleClose}
        />
      )}
    </Card>
  )
}
