'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import type { Plan, BillingInterval } from '@monorepo-template/core/billing/tiers'
import { TIERS } from '@monorepo-template/core/billing/tiers'
import { Button, Eyebrow } from '@/app/(authed)/_dashboard/primitives'
import { useUpgradeModal } from './UpgradeModalProvider'
import { UpdatePaymentMethodForm } from './UpdatePaymentMethodForm'
import { getStripePromise } from './stripe'

interface PlanData {
  plan: Plan
  status: string
  interval: BillingInterval | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

interface SourceStatus {
  provider: string
  providerName: string
  configured: boolean
  status: 'active' | 'invalid' | null
  backgroundPolling: boolean
}

interface UsageData {
  ingestion: { used: number; limit: number | null }
  hum: { used: number; limit: number | null }
  refresh: { used: number; limit: number | null }
  plan: string
  period: 'week' | 'month'
  sources: SourceStatus[]
}

interface CardInfo {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface Invoice {
  id: string
  number: string | null
  amountPaid: number
  currency: string
  status: string | null
  created: number
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatInvoiceDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatAmount(cents: number, currency: string): string {
  const dollars = cents / 100
  const sym = currency.toUpperCase() === 'USD' ? '$' : currency.toUpperCase() + ' '
  return `${sym}${dollars.toFixed(2)}`
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  )
}

// ── Error banner ───────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  )
}

// ── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow({ height = 48 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: 0.5,
      }}
    />
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function BillingPanel() {
  const { openUpgrade } = useUpgradeModal()
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Payment method state
  const [card, setCard] = useState<CardInfo | null | undefined>(undefined) // undefined = not yet fetched
  const [cardLoading, setCardLoading] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [updateCardClientSecret, setUpdateCardClientSecret] = useState<string | null>(null)
  const [updateCardLoading, setUpdateCardLoading] = useState(false)
  const [updateCardError, setUpdateCardError] = useState<string | null>(null)

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)

  // Usage state
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [usageError, setUsageError] = useState<string | null>(null)

  // Cancel / reactivate state
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Fetchers ─────────────────────────────────────────────────────────────

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

  const fetchCard = useCallback(async () => {
    setCardLoading(true)
    setCardError(null)
    try {
      const res = await fetch('/api/billing/payment-method')
      if (!res.ok) {
        setCardError('Could not load payment method.')
        return
      }
      const data = (await res.json()) as { card: CardInfo | null }
      setCard(data.card)
    } catch {
      setCardError('Network error loading payment method.')
    } finally {
      setCardLoading(false)
    }
  }, [])

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    setInvoicesError(null)
    try {
      const res = await fetch('/api/billing/invoices')
      if (!res.ok) {
        setInvoicesError(`Failed to load invoices (${res.status}).`)
        return
      }
      const data = (await res.json()) as { invoices: Invoice[] }
      setInvoices(data.invoices)
    } catch {
      setInvoicesError('Network error loading invoices.')
    } finally {
      setInvoicesLoading(false)
    }
  }, [])

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true)
    setUsageError(null)
    try {
      const res = await fetch('/api/account/usage')
      if (!res.ok) {
        setUsageError(`Couldn't load usage.`)
        return
      }
      const data = (await res.json()) as UsageData
      setUsageData(data)
    } catch {
      setUsageError(`Couldn't load usage.`)
    } finally {
      setUsageLoading(false)
    }
  }, [])

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPlan()
  }, [fetchPlan])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsage()
  }, [fetchUsage])

  // Deep-link from the marketing pricing cards: /account/billing?plan=pro&interval=month
  // → open the upgrade modal once, preselected to the chosen interval. Only for
  // paid tiers (a "free" click just lands on this page). We strip the params so
  // a refresh doesn't reopen the modal.
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current || !planData) return
    const params = new URLSearchParams(window.location.search)
    const plan = params.get('plan')
    if (plan !== 'pro' && plan !== 'alpha') return
    autoOpenedRef.current = true

    const intervalParam = params.get('interval')
    const initialInterval =
      intervalParam === 'month' || intervalParam === 'year' ? intervalParam : undefined

    const url = new URL(window.location.href)
    url.searchParams.delete('plan')
    url.searchParams.delete('interval')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)

    openUpgrade({
      currentPlan: planData.plan,
      initialInterval: initialInterval ?? planData.interval ?? undefined,
      onClose: () => { void fetchPlan() },
    })
  }, [planData, openUpgrade, fetchPlan])

  // Once we know the user is on a paid plan, load card + invoices
  useEffect(() => {
    if (planData && planData.plan !== 'free') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchCard()
      void fetchInvoices()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData?.plan])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCancel() {
    setCancelLoading(true)
    setCancelError(null)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setCancelError(data.error ?? `Failed to cancel (${res.status}).`)
        return
      }
      setCancelConfirm(false)
      await fetchPlan()
    } catch {
      setCancelError('Network error. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleReactivate() {
    setCancelLoading(true)
    setCancelError(null)
    try {
      const res = await fetch('/api/billing/reactivate', { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setCancelError(data.error ?? `Failed to reactivate (${res.status}).`)
        return
      }
      await fetchPlan()
    } catch {
      setCancelError('Network error. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleUpdateCardClick() {
    setUpdateCardLoading(true)
    setUpdateCardError(null)
    try {
      const res = await fetch('/api/billing/update-payment-method', { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setUpdateCardError(data.error ?? `Failed to start card update (${res.status}).`)
        return
      }
      const data = (await res.json()) as { clientSecret: string }
      setUpdateCardClientSecret(data.clientSecret)
    } catch {
      setUpdateCardError('Network error. Please try again.')
    } finally {
      setUpdateCardLoading(false)
    }
  }

  function handleCardUpdateSuccess() {
    setUpdateCardClientSecret(null)
    void fetchCard()
  }

  function handleCardUpdateCancel() {
    setUpdateCardClientSecret(null)
    setUpdateCardError(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const tier = planData ? TIERS[planData.plan] : null
  const isPaid = planData?.plan !== 'free'
  const usagePeriodLabel = usageData?.period === 'week' ? 'week' : 'month'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      {/* Title */}
      <div
        style={{
          font: '600 15px/1.3 var(--font-sans)',
          color: 'var(--fg-1)',
          letterSpacing: '-0.01em',
        }}
      >
        Plan &amp; Billing
      </div>

      {/* ── Plan card ─────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonRow height={52} />
      ) : fetchError ? (
        <ErrorBanner message={fetchError} />
      ) : planData && tier ? (
        <Section label="Current plan">
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
              onClick={() =>
                openUpgrade({
                  currentPlan: planData?.plan,
                  initialInterval: planData?.interval ?? undefined,
                  onClose: () => { void fetchPlan() },
                })
              }
            >
              {isPaid ? 'Change plan' : 'Upgrade plan'}
            </Button>
          </div>
        </Section>
      ) : null}

      {/* ── Usage this week/month ─────────────────────────────────────────── */}
      <Section label={`Usage this ${usagePeriodLabel}`}>
        {usageLoading ? (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              font: '400 13px/1.5 var(--font-sans)',
              color: 'var(--fg-3)',
            }}
          >
            Loading usage…
          </div>
        ) : usageError ? (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              font: '400 13px/1.5 var(--font-sans)',
              color: 'var(--fg-3)',
            }}
          >
            {usageError}
          </div>
        ) : usageData ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Ingestion queries row */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    font: '500 13px/1.3 var(--font-sans)',
                    color: 'var(--fg-2)',
                  }}
                >
                  Ingestion queries
                </span>
                <span
                  style={{
                    font: '400 12px/1.3 var(--font-sans)',
                    color: 'var(--fg-3)',
                  }}
                >
                  {usageData.ingestion.limit === null
                    ? `${usageData.ingestion.used.toLocaleString()} · Unlimited`
                    : `${usageData.ingestion.used.toLocaleString()} / ${usageData.ingestion.limit.toLocaleString()}`}
                </span>
              </div>
              {usageData.ingestion.limit !== null && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--bg-elevated, var(--border))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: 'var(--buzz-500)',
                      width: `${Math.min(100, (usageData.ingestion.used / usageData.ingestion.limit) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Ingestion refreshes row */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    font: '500 13px/1.3 var(--font-sans)',
                    color: 'var(--fg-2)',
                  }}
                >
                  Ingestion refreshes
                </span>
                <span
                  style={{
                    font: '400 12px/1.3 var(--font-sans)',
                    color: 'var(--fg-3)',
                  }}
                >
                  {usageData.refresh.limit === null
                    ? `${usageData.refresh.used.toLocaleString()} · Unlimited`
                    : `${usageData.refresh.used.toLocaleString()} / ${usageData.refresh.limit.toLocaleString()}`}
                </span>
              </div>
              {usageData.refresh.limit !== null && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--bg-elevated, var(--border))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: 'var(--buzz-500)',
                      width: `${Math.min(100, (usageData.refresh.used / usageData.refresh.limit) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Hum AI queries row */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    font: '500 13px/1.3 var(--font-sans)',
                    color: 'var(--fg-2)',
                  }}
                >
                  Hum AI queries
                </span>
                <span
                  style={{
                    font: '400 12px/1.3 var(--font-sans)',
                    color: 'var(--fg-3)',
                  }}
                >
                  {usageData.hum.limit === null
                    ? `${usageData.hum.used.toLocaleString()} · Unlimited`
                    : `${usageData.hum.used.toLocaleString()} / ${usageData.hum.limit.toLocaleString()}`}
                </span>
              </div>
              {usageData.hum.limit !== null && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--bg-elevated, var(--border))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: 'var(--buzz-500)',
                      width: `${Math.min(100, (usageData.hum.used / usageData.hum.limit) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Connected sources subsection */}
            <div style={{ padding: '12px 16px' }}>
              <div
                style={{
                  font: '600 11px/1 var(--font-sans)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-3)',
                  marginBottom: 10,
                }}
              >
                Connected sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {usageData.sources.map((src) => (
                  <div
                    key={src.provider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        font: '400 13px/1.3 var(--font-sans)',
                        color: 'var(--fg-2)',
                        flex: 1,
                      }}
                    >
                      {src.providerName}
                      {src.backgroundPolling && (
                        <span
                          style={{
                            font: '400 11px/1.3 var(--font-sans)',
                            color: 'var(--fg-4, var(--fg-3))',
                            marginLeft: 6,
                          }}
                        >
                          · background polling on
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        font: '600 11px/1 var(--font-sans)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        ...(src.configured && src.status === 'active'
                          ? {
                              background: 'var(--bull-100, rgba(34,197,94,0.12))',
                              color: 'var(--bull-500, #16a34a)',
                            }
                          : src.configured && src.status === 'invalid'
                          ? {
                              background: 'var(--bear-100, rgba(220,53,69,0.1))',
                              color: 'var(--bear-500, #dc3545)',
                            }
                          : {
                              background: 'var(--neutral-100, rgba(107,114,128,0.12))',
                              color: 'var(--fg-3)',
                            }),
                      }}
                    >
                      {src.configured && src.status === 'active'
                        ? 'Connected'
                        : src.configured && src.status === 'invalid'
                        ? 'Invalid key'
                        : 'Not connected'}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  font: '400 12px/1.5 var(--font-sans)',
                  color: 'var(--fg-3)',
                  marginTop: 12,
                }}
              >
                Manage API keys in the <strong>API Keys</strong> tab.
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Paid-only sections ─────────────────────────────────────────────── */}
      {!loading && !fetchError && planData && isPaid && (
        <>
          {/* ── Cancel / Reactivate ─────────────────────────────────────────── */}
          <Section label="Subscription">
            {cancelError && <ErrorBanner message={cancelError} />}

            {planData.cancelAtPeriodEnd ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  gap: 12,
                }}
              >
                <div
                  style={{
                    font: '400 13px/1.5 var(--font-sans)',
                    color: 'var(--fg-2)',
                  }}
                >
                  Your subscription is set to cancel. Access continues until the period end.
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={cancelLoading}
                  onClick={() => void handleReactivate()}
                  style={{ flexShrink: 0 }}
                >
                  {cancelLoading ? 'Processing…' : 'Reactivate'}
                </Button>
              </div>
            ) : cancelConfirm ? (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--bear-100, rgba(220,53,69,0.07))',
                  border: '1px solid var(--bear-300, rgba(220,53,69,0.25))',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    font: '500 13px/1.5 var(--font-sans)',
                    color: 'var(--fg-1)',
                  }}
                >
                  Are you sure you want to cancel? You&apos;ll keep access until the end of your current billing period.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={cancelLoading}
                    onClick={() => void handleCancel()}
                  >
                    {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelLoading}
                    onClick={() => { setCancelConfirm(false); setCancelError(null) }}
                  >
                    Keep subscription
                  </Button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  gap: 12,
                }}
              >
                <div
                  style={{
                    font: '400 13px/1.5 var(--font-sans)',
                    color: 'var(--fg-2)',
                  }}
                >
                  You can cancel anytime — access continues until the billing period ends.
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ flexShrink: 0, color: 'var(--bear-500, #dc3545)', borderColor: 'var(--bear-300, rgba(220,53,69,0.3))' }}
                  onClick={() => { setCancelConfirm(true); setCancelError(null) }}
                >
                  Cancel subscription
                </Button>
              </div>
            )}
          </Section>

          {/* ── Payment method ───────────────────────────────────────────────── */}
          <Section label="Payment method">
            {cardLoading ? (
              <SkeletonRow height={52} />
            ) : cardError ? (
              <ErrorBanner message={cardError} />
            ) : updateCardClientSecret ? (
              /* Inline card update form inside an Elements provider */
              <div
                style={{
                  padding: '16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <Elements
                  stripe={getStripePromise()}
                  options={{ clientSecret: updateCardClientSecret, appearance: { theme: 'night' } }}
                >
                  <UpdatePaymentMethodForm
                    onSuccess={handleCardUpdateSuccess}
                    onCancel={handleCardUpdateCancel}
                  />
                </Elements>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {card ? (
                    <>
                      <div
                        style={{
                          font: '500 13px/1.3 var(--font-sans)',
                          color: 'var(--fg-1)',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        •••• {card.last4}
                        <span
                          style={{
                            marginLeft: 8,
                            font: '400 13px/1.3 var(--font-sans)',
                            color: 'var(--fg-3)',
                          }}
                        >
                          {capitalize(card.brand)}
                        </span>
                      </div>
                      <div
                        style={{
                          font: '400 12px/1.4 var(--font-sans)',
                          color: 'var(--fg-3)',
                        }}
                      >
                        Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        font: '400 13px/1.4 var(--font-sans)',
                        color: 'var(--fg-3)',
                      }}
                    >
                      No card on file
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {updateCardError && (
                    <span
                      style={{
                        font: '500 12px/1.4 var(--font-sans)',
                        color: 'var(--bear-500, #dc3545)',
                        maxWidth: 200,
                      }}
                    >
                      {updateCardError}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updateCardLoading}
                    onClick={() => void handleUpdateCardClick()}
                  >
                    {updateCardLoading ? 'Loading…' : 'Update card'}
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* ── Invoices ─────────────────────────────────────────────────────── */}
          <Section label="Invoices">
            {invoicesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonRow height={40} />
                <SkeletonRow height={40} />
                <SkeletonRow height={40} />
              </div>
            ) : invoicesError ? (
              <ErrorBanner message={invoicesError} />
            ) : invoices && invoices.length === 0 ? (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  font: '400 13px/1.5 var(--font-sans)',
                  color: 'var(--fg-3)',
                }}
              >
                No invoices yet.
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {invoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto auto',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Date */}
                    <div
                      style={{
                        font: '400 13px/1.3 var(--font-sans)',
                        color: 'var(--fg-2)',
                      }}
                    >
                      {formatInvoiceDate(inv.created)}
                      {inv.number && (
                        <span
                          style={{
                            marginLeft: 8,
                            font: '400 12px/1.3 var(--font-mono)',
                            color: 'var(--fg-3)',
                          }}
                        >
                          {inv.number}
                        </span>
                      )}
                    </div>

                    {/* Amount */}
                    <div
                      style={{
                        font: '600 13px/1.3 var(--font-sans)',
                        color: 'var(--fg-1)',
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAmount(inv.amountPaid, inv.currency)}
                    </div>

                    {/* Status pill */}
                    <div
                      style={{
                        font: '600 11px/1 var(--font-sans)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        ...(inv.status === 'paid'
                          ? {
                              background: 'var(--bull-100, rgba(34,197,94,0.12))',
                              color: 'var(--bull-500, #16a34a)',
                            }
                          : inv.status === 'open'
                          ? {
                              background: 'rgba(234,179,8,0.12)',
                              color: '#ca8a04',
                            }
                          : {
                              background: 'var(--neutral-100, rgba(107,114,128,0.12))',
                              color: 'var(--fg-3)',
                            }),
                      }}
                    >
                      {inv.status ?? 'unknown'}
                    </div>

                    {/* Links */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {inv.hostedInvoiceUrl && (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            font: '500 12px/1 var(--font-sans)',
                            color: 'var(--buzz-500)',
                            textDecoration: 'none',
                          }}
                        >
                          View
                        </a>
                      )}
                      {inv.invoicePdf && (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            font: '500 12px/1 var(--font-sans)',
                            color: 'var(--fg-3)',
                            textDecoration: 'none',
                          }}
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        </>
      )}

    </div>
  )
}
