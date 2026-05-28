'use client'

import { UserProfile } from '@clerk/nextjs'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { ApiKeysSection } from './ApiKeysSection'
import { BillingPanel } from '@/app/_billing/BillingPanel'
import { Icon } from '@/app/(authed)/_dashboard/primitives'
// Account page reuses the shared tb-* component styles (tabs, form, fields,
// buttons) that live in auth.css — which is otherwise only loaded by AuthShell.
import '@/app/_auth/auth.css'

export default function AccountPage() {
  const isMobile = useIsMobile()

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <UserProfile
          path="/account"
          routing="path"
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
        >
          <UserProfile.Page
            label="API Keys"
            labelIcon={<Icon name="settings" size={16} />}
            url="api-keys"
          >
            <ApiKeysSection />
          </UserProfile.Page>
          <UserProfile.Page
            label="Plan & Billing"
            labelIcon={<Icon name="star" size={16} />}
            url="billing"
          >
            <BillingPanel />
          </UserProfile.Page>
        </UserProfile>
      </div>
    </div>
  )
}
