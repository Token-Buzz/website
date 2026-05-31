'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WatchlistView } from '../_dashboard/WatchlistView'
import { TokenDetailPane } from '../_dashboard/TokenDetailPane'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Token } from '../_dashboard/types'

// Desktop pane widths.
const PANE_DEFAULT_WIDTH = 680
const PANE_MIN_WIDTH = 400
// Maximum width the user can drag the pane to: 75% of the viewport.
const PANE_MAX_WIDTH_FRACTION = 0.75

export default function WatchlistPage() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [autoAdd, setAutoAdd] = useState(false)
  // Pixel width of the detail pane (desktop only). Resets on token change.
  const [paneWidth, setPaneWidth] = useState(PANE_DEFAULT_WIDTH)
  const isMobile = useIsMobile()

  // Drag-to-resize refs — kept outside state to avoid re-renders during drag.
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const f = params.get('focus')
    const add = params.get('add')
    Promise.resolve().then(() => {
      if (f) setFocus(f)
      if (add === '1') setAutoAdd(true)
    }).catch(() => {})
  }, [])

  // Lock body scroll while mobile overlay is open
  useEffect(() => {
    if (isMobile && selectedToken) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, selectedToken])

  const handleSelectToken = (token: Token | null) => {
    setSelectedToken(token)
    // Reset to default width when opening a new token
    setPaneWidth(PANE_DEFAULT_WIDTH)
  }

  const handleClose = () => {
    setSelectedToken(null)
    setPaneWidth(PANE_DEFAULT_WIDTH)
  }

  // Snap to max (75 vw) when collapsed, or back to default when expanded.
  const handleToggleExpand = useCallback(() => {
    const maxWidth = Math.floor(window.innerWidth * PANE_MAX_WIDTH_FRACTION)
    setPaneWidth((w) => (w >= maxWidth - 10 ? PANE_DEFAULT_WIDTH : maxWidth))
  }, [])

  // Begin a drag-resize interaction on the left edge handle.
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = paneWidth

    // Apply a global cursor override so it doesn't flicker while dragging fast.
    document.documentElement.style.cursor = 'col-resize'
    document.documentElement.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return
      // Moving left (negative delta) increases pane width.
      const delta = dragStartX.current - ev.clientX
      const maxWidth = Math.floor(window.innerWidth * PANE_MAX_WIDTH_FRACTION)
      const newWidth = Math.max(PANE_MIN_WIDTH, Math.min(maxWidth, dragStartWidth.current + delta))
      setPaneWidth(newWidth)
    }

    function onMouseUp() {
      isDragging.current = false
      document.documentElement.style.cursor = ''
      document.documentElement.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [paneWidth])

  // `expanded` reflects whether the pane is wider than the default.
  const paneExpanded = paneWidth > PANE_DEFAULT_WIDTH + 20

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Main list — always rendered */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <WatchlistView
          onSelectToken={handleSelectToken}
          selectedToken={selectedToken}
          initialFocus={focus}
          autoOpenAdd={autoAdd}
        />
      </div>

      {/* Detail pane — side panel on desktop, full-screen overlay on mobile */}
      {selectedToken && (
        isMobile ? (
          // Mobile: fixed full-screen overlay covering the entire viewport
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 20,
              background: 'var(--bg)',
              overflowY: 'auto',
            }}
          >
            <TokenDetailPane
              token={selectedToken}
              onClose={handleClose}
            />
          </div>
        ) : (
          // Desktop: side panel with drag-to-resize left edge handle
          <div style={{
            width: paneWidth,
            borderLeft: '1px solid var(--border)',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 0,
            position: 'relative',
          }}>
            {/* Drag-resize handle — straddles the left border for an easy grab target */}
            <div
              onMouseDown={handleResizeStart}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: -8,
                top: 0,
                bottom: 0,
                width: 16,
                cursor: 'col-resize',
                zIndex: 10,
              }}
            />
            <TokenDetailPane
              token={selectedToken}
              onClose={handleClose}
              expanded={paneExpanded}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        )
      )}
    </div>
  )
}
