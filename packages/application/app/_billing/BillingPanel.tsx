'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Plan, BillingInterval } from '@monorepo-template/core/billing/tiers'
import { TIERS } from '@monorepo-template/core/billing/tiers'
import { Button } from '@/app/(authed)/_dashboard/primitives'
import { UpgradeModal } from './UpgradeModal'

interface PlanData {
  plan: Plan
  status: string
  interval: BillingInterval | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function BillingPanel() {
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/billing/plan')
      if (!res.ok) {
        setFetchError(`Failed to load plan (${res.status}).`)
        return
      }
      const data = (await res.json()) as PlanData
      setPlanData(data)
    } catch {
      setFetchError('Network error. Could not load plan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPlan()
  }, [fetchPlan])

  function handleModalClose() {
    setModalOpen(false)
    void fetchPlan()
  }

  const tier = planData ? TIERS[planData.plan] : null
  const isPaid = planData?.plan !== 'free'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      <div
        style={{
          font: '600 15px/1.3 var(--font-sans)',
          color: 'var(--fg-1)',
          letterSpacing: '-0.01em',
        }}
      >
        Plan &amp; Billing
      </div>

      {loading ? (
        <div
          style={{
            height: 52,
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            opacity: 0.5,
          }}
        />
      ) : fetchError ? (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bear-100, rgba(220,53,69,0.1))',
            border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
            borderRadius: 6,
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--bear-500, #dc3545)',
          }}
        >
          {fetchError}
        </div>
      ) : planData && tier ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  font: '600 14px/1.2 var(--font-sans)',
                  color: 'var(--fg-1)',
                }}
              >
                {tier.label} plan
              </div>
              {isPaid && planData.interval && (
                <div
                  style={{
                    font: '400 12px/1.4 var(--font-sans)',
                    color: 'var(--fg-3)',
                    marginTop: 3,
                  }}
                >
                  Billed {planData.interval === 'month' ? 'monthly' : 'yearly'}
                  {planData.status === 'active' ? '' : ` · ${planData.status}`}
                </div>
              )}
              {planData.cancelAtPeriodEnd && planData.currentPeriodEnd && (
                <div
                  style={{
                    font: '500 12px/1.4 var(--font-sans)',
                    color: 'var(--bear-500, #dc3545)',
                    marginTop: 3,
                  }}
                >
                  Cancels at period end:{' '}
                  {new Date(planData.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalOpen(true)}
            >
              {isPaid ? 'Change plan' : 'Upgrade plan'}
            </Button>
          </div>
        </div>
      ) : null}

      <UpgradeModal
        open={modalOpen}
        onClose={handleModalClose}
        currentPlan={planData?.plan}
        initialInterval={planData?.interval ?? undefined}
      />
    </div>
  )
}
