'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isDunning, graceDaysRemaining } from '@monorepo-template/core/billing/stripe'
import { Icon, Button } from './primitives'

interface PlanData {
  status: string
  gracePeriodEndsAt: string | null
}

export function DunningBanner() {
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/billing/plan')
        if (!res.ok) return
        const data = (await res.json()) as PlanData
        if (!cancelled) setPlanData(data)
      } catch {
        // best-effort; swallow network errors
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!planData || !isDunning(planData.status)) return null

  const daysLeft = graceDaysRemaining(planData.gracePeriodEndsAt)

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px 16px',
        padding: '10px 16px',
        background: 'var(--bear-500, #dc3545)',
        color: '#fff',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1.4 var(--font-sans)' }}>
        <Icon name="bell" size={15} style={{ flexShrink: 0 }} />
        <span>
          Payment failed — update your card to keep your plan.
          {daysLeft > 0 && (
            <span style={{ opacity: 0.85, marginLeft: 6 }}>
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left.
            </span>
          )}
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push('/account/billing')}
        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        Update payment method
      </Button>
    </div>
  )
}
