'use client'

import { useState, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { TIERS, PAID_PLANS, type Plan, type BillingInterval } from '@monorepo-template/core/billing/tiers'
import { Button, Eyebrow, Icon } from '@/app/(authed)/_dashboard/primitives'
import { getStripePromise } from './stripe'
import { SubscribeForm } from './SubscribeForm'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  currentPlan?: Plan
  initialInterval?: BillingInterval
}

type Step = 'select' | 'pay' | 'done'

function formatPrice(amount: number, interval: BillingInterval): string {
  const dollars = amount / 100
  return interval === 'month' ? `$${dollars}/mo` : `$${dollars}/yr`
}

export function UpgradeModal({ open, onClose, currentPlan, initialInterval }: UpgradeModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [interval, setInterval] = useState<BillingInterval>(initialInterval ?? 'month')
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep('select')
      setClientSecret(null)
      setError(null)
      setLoadingPlan(null)
      setInterval(initialInterval ?? 'month')
    }
  }, [open, initialInterval])

  // Escape-to-close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  async function startCheckout(plan: Plan) {
    setError(null)
    setLoadingPlan(plan)
    try {
      if (currentPlan && currentPlan !== 'free') {
        // Already paying — switch via change-plan (uses saved PM)
        const res = await fetch('/api/billing/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, interval }),
        })
        if (res.ok) {
          setSelectedPlan(plan)
          setStep('done')
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `Failed to switch plan (${res.status}).`)
        }
      } else {
        // Free → paid: create subscription
        const res = await fetch('/api/billing/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, interval }),
        })
        if (res.status === 409) {
          // Already subscribed — fall back to change-plan
          const cp = await fetch('/api/billing/change-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, interval }),
          })
          if (cp.ok) {
            setSelectedPlan(plan)
            setStep('done')
          } else {
            const data = (await cp.json().catch(() => ({}))) as { error?: string }
            setError(data.error ?? `Failed to switch plan (${cp.status}).`)
          }
        } else if (res.ok) {
          const data = (await res.json()) as { clientSecret: string }
          setClientSecret(data.clientSecret)
          setSelectedPlan(plan)
          setStep('pay')
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `Failed to start checkout (${res.status}).`)
        }
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  const allPlans: Plan[] = ['free', 'pro', 'alpha']

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: step === 'select' ? 760 : 520,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow style={{ marginBottom: 4 }}>Plan</Eyebrow>
            <h2
              id="upgrade-modal-title"
              style={{
                font: '600 18px/1.2 var(--font-sans)',
                color: 'var(--fg-1)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              {step === 'done' ? 'Subscription updated' : 'Choose your plan'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--fg-3)',
              padding: 4,
              borderRadius: 4,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Select step */}
        {step === 'select' && (
          <>
            {/* Interval toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 3,
                  gap: 3,
                }}
              >
                {(['month', 'year'] as BillingInterval[]).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      font: '600 13px/1 var(--font-sans)',
                      cursor: 'pointer',
                      transition: 'all 120ms',
                      background: interval === iv ? 'var(--bg-elevated)' : 'transparent',
                      color: interval === iv ? 'var(--fg-1)' : 'var(--fg-3)',
                      boxShadow: interval === iv ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    }}
                  >
                    {iv === 'month' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
              {interval === 'year' && (
                <span
                  style={{
                    font: '600 12px/1 var(--font-sans)',
                    color: 'var(--buzz-500)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  2 months free
                </span>
              )}
            </div>

            {/* Plan columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}
            >
              {allPlans.map((plan) => {
                const tier = TIERS[plan]
                const isCurrent = plan === currentPlan
                const isPaid = PAID_PLANS.includes(plan as 'pro' | 'alpha')
                const priceStr =
                  tier.prices && interval in tier.prices
                    ? formatPrice(tier.prices[interval].amount, interval)
                    : '$0'
                const isLoading = loadingPlan === plan

                return (
                  <div
                    key={plan}
                    style={{
                      background: 'var(--surface)',
                      border: isCurrent
                        ? '2px solid var(--buzz-500)'
                        : '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      position: 'relative',
                    }}
                  >
                    {/* Most popular badge */}
                    {plan === 'pro' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -11,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'var(--buzz-500)',
                          color: '#fff',
                          font: '700 10px/1 var(--font-sans)',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Most popular
                      </div>
                    )}

                    {/* Plan name + current tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          font: '700 15px/1.2 var(--font-sans)',
                          color: 'var(--fg-1)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {tier.label}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            font: '600 10px/1 var(--font-sans)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--buzz-500)',
                            background: 'rgba(255,107,44,0.12)',
                            padding: '3px 7px',
                            borderRadius: 999,
                          }}
                        >
                          Current plan
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div
                      style={{
                        font: '700 22px/1 var(--font-sans)',
                        color: 'var(--fg-1)',
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {priceStr}
                    </div>

                    {/* Quota rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(() => {
                        const per = tier.period === 'week' ? 'wk' : 'mo'
                        return (
                          <>
                            <div
                              style={{
                                font: '400 13px/1.4 var(--font-sans)',
                                color: 'var(--fg-2)',
                              }}
                            >
                              Hum AI:{' '}
                              <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                                {tier.humLimit !== null ? `${tier.humLimit}` : 'Unlimited'} / {per}
                              </span>
                            </div>
                            <div
                              style={{
                                font: '400 13px/1.4 var(--font-sans)',
                                color: 'var(--fg-2)',
                              }}
                            >
                              Ingestion:{' '}
                              <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                                {tier.ingestionLimit !== null ? `${tier.ingestionLimit}` : 'Unlimited'} / {per}
                              </span>
                            </div>
                            <div
                              style={{
                                font: '400 13px/1.4 var(--font-sans)',
                                color: 'var(--fg-2)',
                              }}
                            >
                              Refresh:{' '}
                              <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                                {tier.refreshLimit !== null ? `${tier.refreshLimit}` : 'Unlimited'} / {per}
                              </span>
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    {/* CTA */}
                    {isPaid && (
                      <Button
                        variant={isCurrent ? 'ghost' : 'primary'}
                        size="md"
                        disabled={isCurrent || isLoading || loadingPlan !== null}
                        onClick={() => { if (!isCurrent) void startCheckout(plan) }}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {isLoading
                          ? 'Loading…'
                          : isCurrent
                          ? 'Current plan'
                          : `${currentPlan && currentPlan !== 'free' ? 'Switch' : 'Upgrade'} to ${tier.label}`}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Error banner */}
            {error && (
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
                {error}
              </div>
            )}
          </>
        )}

        {/* Pay step */}
        {step === 'pay' && clientSecret && (
          <Elements
            stripe={getStripePromise()}
            options={{ clientSecret, appearance: { theme: 'night' } }}
          >
            <SubscribeForm
              planLabel={TIERS[selectedPlan].label}
              onSuccess={() => setStep('done')}
              onBack={() => setStep('select')}
            />
          </Elements>
        )}

        {/* Done step */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
            <p
              style={{
                font: '400 15px/1.6 var(--font-sans)',
                color: 'var(--fg-2)',
                margin: 0,
              }}
            >
              You&apos;re subscribed to{' '}
              <strong style={{ color: 'var(--fg-1)' }}>{TIERS[selectedPlan].label}</strong>.
              Your plan will update in a moment.
            </p>
            <Button variant="primary" size="md" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
