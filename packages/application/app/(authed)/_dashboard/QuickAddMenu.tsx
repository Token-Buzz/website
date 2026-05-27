'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from './primitives'
import type { CommandItem } from './CommandPalette'

// ── QuickAddMenu ───────────────────────────────────────────────────────────
// A `+` trigger button that opens a small dropdown menu of quick-add actions.
// Close-on-outside-click pattern mirrors ProfileFooter in Shell.tsx.

export function QuickAddMenu({
  items,
  compact,
}: {
  items: CommandItem[]
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const triggerPadding = compact ? '6px 8px' : '5px 8px'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        aria-label="Quick add"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--fg-3)',
          cursor: 'pointer',
          lineHeight: 0,
          padding: triggerPadding,
        }}
      >
        <Icon name="plus" size={14} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 200,
            zIndex: 20,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => {
                item.onSelect()
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                color: 'var(--fg-2)',
                font: '500 13px var(--font-sans)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.icon && <Icon name={item.icon} size={14} style={{ color: 'var(--fg-3)' }} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
