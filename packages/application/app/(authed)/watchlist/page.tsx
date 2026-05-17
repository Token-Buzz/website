'use client'

import { useState } from 'react'
import { WatchlistView } from '../_dashboard/WatchlistView'
import { TokenDetailPane } from '../_dashboard/TokenDetailPane'
import type { Token } from '../_dashboard/types'

export default function WatchlistPage() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <WatchlistView
          onSelectToken={setSelectedToken}
          selectedToken={selectedToken}
        />
      </div>
      {selectedToken && (
        <div style={{ width: 680, borderLeft: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
          <TokenDetailPane
            token={selectedToken}
            onClose={() => setSelectedToken(null)}
          />
        </div>
      )}
    </div>
  )
}
