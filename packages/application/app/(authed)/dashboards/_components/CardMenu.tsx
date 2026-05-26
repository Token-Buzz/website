'use client'

import { useState, useEffect, useRef } from 'react'

// ── CardMenu ──────────────────────────────────────────────────────────────────

export interface CardMenuAction {
  label: string
  onSelect: () => void
  danger?: boolean
}

export function CardMenu({ actions }: { actions: CardMenuAction[] }) {
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

  // Find the index of the first danger action (for divider placement)
  const firstDangerIndex = actions.findIndex((a) => a.danger)

  return (
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
          {actions.map((action, i) => (
            <div key={action.label}>
              {/* Divider immediately before the first danger action */}
              {action.danger && i === firstDangerIndex && (
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              )}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  action.onSelect()
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
                  color: action.danger ? 'var(--bear-500, #dc3545)' : 'var(--fg-1)',
                  letterSpacing: '-0.005em',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-sunken)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
