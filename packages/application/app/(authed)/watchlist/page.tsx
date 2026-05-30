'use client'

import { useState, useEffect } from 'react'
import { WatchlistView } from '../_dashboard/WatchlistView'
import { TokenDetailPane } from '../_dashboard/TokenDetailPane'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Token } from '../_dashboard/types'

// Desktop pane widths. Expanded leaves at least the sidebar + list visible.
const PANE_WIDTH_NARROW = 680
const PANE_WIDTH_EXPANDED = 'min(1200px, calc(100vw - 320px))'

export default function WatchlistPage() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  // Expanded state resets to false whenever a new token is opened
  const [paneExpanded, setPaneExpanded] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('focus')
    Promise.resolve().then(() => { if (f) setFocus(f) }).catch(() => {})
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
    // Reset to narrow when opening a new token
    setPaneExpanded(false)
  }

  const handleClose = () => {
    setSelectedToken(null)
    setPaneExpanded(false)
  }

  const handleToggleExpand = () => setPaneExpanded((v) => !v)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Main list — always rendered */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <WatchlistView
          onSelectToken={handleSelectToken}
          selectedToken={selectedToken}
          initialFocus={focus}
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
          // Desktop: side panel with animated width transition
          <div style={{
            width: paneExpanded ? PANE_WIDTH_EXPANDED : PANE_WIDTH_NARROW,
            borderLeft: '1px solid var(--border)',
            overflowY: 'auto',
            flexShrink: 0,
            transition: 'width 180ms ease',
          }}>
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
