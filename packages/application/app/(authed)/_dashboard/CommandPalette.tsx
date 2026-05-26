'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Icon, Eyebrow } from './primitives'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommandItem {
  id: string
  label: string
  icon?: React.ComponentProps<typeof Icon>['name']
  swatch?: string        // optional color dot; render a small square if present
  hint?: string          // optional right-aligned muted hint text
  keywords?: string      // extra text to match against
  onSelect: () => void
}

export interface CommandSection {
  id: string
  heading: string
  items: CommandItem[]
}

// ── CommandPaletteInner ────────────────────────────────────────────────────
// Rendered only when open=true; being unmounted/remounted on open transitions
// means initial state is always clean — no reset effects needed.

function CommandPaletteInner({
  onClose,
  sections,
  contextual,
}: {
  onClose: () => void
  sections: CommandSection[]
  contextual?: (query: string) => CommandItem | null
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus the input on mount (i.e. when the palette opens)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(id)
  }, [])

  // Body scroll lock while mounted (open)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Build filtered sections and flat visible items list
  const { filteredSections, flatItems } = useMemo(() => {
    const q = query.toLowerCase().trim()
    const filtered = sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!q) return true
          const haystack = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
          return haystack.includes(q)
        }),
      }))
      .filter((section) => section.items.length > 0)

    const trimmed = query.trim()
    const contextualItem = trimmed ? contextual?.(trimmed) ?? null : null
    const sectionsOut = contextualItem
      ? [{ id: '__contextual', heading: 'Hum', items: [contextualItem] }, ...filtered]
      : filtered
    const flat: CommandItem[] = sectionsOut.flatMap((s) => s.items)
    return { filteredSections: sectionsOut, flatItems: flat }
  }, [query, sections, contextual])

  // Clamp activeIndex to the current visible range with wrap-around
  const clampedIndex = flatItems.length > 0
    ? ((activeIndex % flatItems.length) + flatItems.length) % flatItems.length
    : 0

  const handleSelect = useCallback((item: CommandItem) => {
    item.onSelect()
    onClose()
  }, [onClose])

  // Change query and reset activeIndex in the same event handler (not an effect)
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setActiveIndex(0)
  }, [])

  // Keyboard navigation — attached while mounted
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) =>
          flatItems.length > 0 ? (i + 1) % flatItems.length : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) =>
          flatItems.length > 0
            ? ((i - 1 + flatItems.length) % flatItems.length)
            : 0
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const activeItem = flatItems[clampedIndex]
        if (activeItem) handleSelect(activeItem)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [flatItems, clampedIndex, handleSelect, onClose])

  // Build a flat counter so we can track which flat index each item has
  let flatCounter = 0

  return (
    // Overlay
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: '12vh',
      }}
    >
      {/* Backdrop scrim — click to close */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Modal box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(520px, calc(100vw - 32px))',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <Icon name="search" size={16} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search dashboards and actions…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: '500 15px var(--font-sans)',
              color: 'var(--fg-1)',
              minWidth: 0,
            }}
          />
          <kbd style={{
            font: '500 10px var(--font-mono)',
            color: 'var(--fg-3)',
            background: 'var(--ink-100)',
            padding: '2px 6px',
            borderRadius: 4,
            flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results region */}
        <div
          role="listbox"
          style={{
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: 6,
          }}
        >
          {flatItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '28px 0',
              font: '500 13px var(--font-sans)',
              color: 'var(--fg-3)',
            }}>
              No results
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id}>
                {/* Section heading */}
                <div style={{ padding: '8px 10px 4px' }}>
                  <Eyebrow>{section.heading}</Eyebrow>
                </div>

                {/* Section items */}
                {section.items.map((item) => {
                  const itemFlatIndex = flatCounter++
                  const isActive = itemFlatIndex === clampedIndex

                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(itemFlatIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        font: '500 13px var(--font-sans)',
                        color: 'var(--fg-1)',
                        background: isActive
                          ? 'var(--surface-active, var(--surface))'
                          : 'transparent',
                      }}
                    >
                      {/* Leading: swatch or icon */}
                      {item.swatch ? (
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: item.swatch,
                          flexShrink: 0,
                        }} />
                      ) : item.icon ? (
                        <Icon
                          name={item.icon}
                          size={14}
                          style={{ color: 'var(--fg-3)', flexShrink: 0 }}
                        />
                      ) : null}

                      {/* Label */}
                      <span style={{ flex: 1 }}>{item.label}</span>

                      {/* Hint */}
                      {item.hint && (
                        <span style={{
                          font: '500 11px var(--font-mono)',
                          color: 'var(--fg-3)',
                          flexShrink: 0,
                        }}>
                          {item.hint}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── CommandPalette ─────────────────────────────────────────────────────────
// Renders null when closed; the inner component mounts fresh each time open
// transitions from false→true, so initial state is always clean.

export function CommandPalette({
  open,
  onClose,
  sections,
  contextual,
}: {
  open: boolean
  onClose: () => void
  sections: CommandSection[]
  contextual?: (query: string) => CommandItem | null
}) {
  if (!open) return null
  return <CommandPaletteInner onClose={onClose} sections={sections} contextual={contextual} />
}
