'use client'

import { UserProfile } from '@clerk/nextjs'
import { useIsMobile } from '@/app/_hooks/useIsMobile'

export default function AccountPage() {
  const isMobile = useIsMobile()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: isMobile ? '16px 8px' : '32px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <UserProfile
        appearance={isMobile ? {
          elements: {
            rootBox: { width: '100%' },
            cardBox: { width: '100%', maxWidth: '100%' },
          },
        } : undefined}
      />
    </div>
  )
}
