'use client'

import { useState, useEffect } from 'react'
import { WatchlistView } from '../_dashboard/WatchlistView'
import { TokenDetailPane } from '../_dashboard/TokenDetailPane'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import type { Token } from '../_dashboard/types'

export default function WatchlistPage() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
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

  const handleClose = () => setSelectedToken(null)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Main list — always rendered */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <WatchlistView
          onSelectToken={setSelectedToken}
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
          // Desktop: fixed-width side panel beside the list
          <div style={{ width: 680, borderLeft: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
            <TokenDetailPane
              token={selectedToken}
              onClose={handleClose}
            />
          </div>
        )
      )}
    </div>
  )
}
