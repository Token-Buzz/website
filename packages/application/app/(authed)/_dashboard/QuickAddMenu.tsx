'use client'

import { useState, useEffect, useRef } from 'react'
import type { CommandItem } from './CommandPalette'
import { Icon } from './primitives'

export function QuickAddMenu({ items, isMobile }: { items: CommandItem[]; isMobile: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="Quick add"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--fg-3)', cursor: 'pointer', lineHeight: 0,
          padding: isMobile ? '6px 8px' : '5px 8px',
        }}
      >
        <Icon name="plus" size={14} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 200,
            zIndex: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => { item.onSelect(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--fg-2)', font: '500 13px var(--font-sans)', cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
