'use client'

import { useState } from 'react'
import { UserProfile } from '@clerk/nextjs'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { ApiKeysSection } from './ApiKeysSection'
// Account page reuses the shared tb-* component styles (tabs, form, fields,
// buttons) that live in auth.css — which is otherwise only loaded by AuthShell.
import '@/app/_auth/auth.css'

type Tab = 'profile' | 'api-keys'

export default function AccountPage() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '16px 8px' : '32px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          marginBottom: 'var(--sp-5)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            position: 'relative',
            background: 'var(--bg-sunken)',
            borderRadius: 'var(--r-3)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`tb-tab${tab === 'profile' ? ' is-active' : ''}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setTab('api-keys')}
            className={`tb-tab${tab === 'api-keys' ? ' is-active' : ''}`}
          >
            API Keys
          </button>
          {/* Sliding underline indicator */}
          <div
            className="tb-tab-indicator"
            style={{
              transform: tab === 'profile' ? 'translateX(0%)' : 'translateX(100%)',
            }}
          />
        </div>
      </div>

      {/* Tab content */}
      {tab === 'profile' ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <UserProfile
            appearance={
              isMobile
                ? {
                    elements: {
                      rootBox: { width: '100%' },
                      cardBox: { width: '100%', maxWidth: '100%' },
                    },
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          <ApiKeysSection />
        </div>
      )}
    </div>
  )
}
