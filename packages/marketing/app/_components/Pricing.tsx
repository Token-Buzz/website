'use client'

import React, { useState } from 'react'
import BuzzDot from './BuzzDot'
import Button from './Button'
import Icon from './Icon'

type Interval = 'month' | 'year'

interface PlanDef {
  tier: string
  slug: 'free' | 'pro' | 'alpha'
  tagline: string
  monthlyPrice: number | null  // null = free
  yearlyPrice: number | null   // null = free
  features: string[]
  cta: string
  featured?: boolean
}

const PLANS: PlanDef[] = [
  {
    tier: 'Free',
    slug: 'free',
    tagline: 'For the curious. No card required.',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      '10 Hum AI queries / month',
      '5 token ingestions / month',
      'X + Farcaster sources',
      'Unlimited dashboards, alerts & watchlists',
      'Email alerts',
    ],
    cta: 'Start free',
  },
  {
    tier: 'Pro',
    slug: 'pro',
    tagline: 'For traders running real positions.',
    monthlyPrice: 24,
    yearlyPrice: 240,
    features: [
      '500 Hum AI queries / month',
      '50 token ingestions / month',
      'X + Farcaster + Reddit sources',
      'Unlimited dashboards, alerts & watchlists',
      'Push, email & Discord alerts',
      'Real-time buzz feed',
    ],
    cta: 'Start with Pro',
    featured: true,
  },
  {
    tier: 'Alpha',
    slug: 'alpha',
    tagline: 'For desks, funds, and the impatient.',
    monthlyPrice: 240,
    yearlyPrice: 2400,
    features: [
      'Unlimited Hum AI queries',
      'Unlimited token ingestion',
      'All sources incl. Telegram & Discord',
      'Everything in Pro',
    ],
    cta: 'Go Alpha',
  },
]

interface PriceCardProps {
  plan: PlanDef
  interval: Interval
}

function PriceCard({ plan, interval }: PriceCardProps) {
  const { tier, slug, tagline, monthlyPrice, yearlyPrice, features, cta, featured } = plan
  const isFree = monthlyPrice === null

  // Derived price display
  let displayPrice: string
  let displayPeriod: string
  let billedLine: string | null = null
  let savingsBadge: string | null = null

  if (isFree) {
    displayPrice = '$0'
    displayPeriod = 'forever'
  } else if (interval === 'month') {
    displayPrice = `$${monthlyPrice}`
    displayPeriod = '/month'
  } else {
    // yearly: show per-month equivalent
    const perMonth = Math.round(yearlyPrice! / 12)
    const savings = monthlyPrice! * 12 - yearlyPrice!
    displayPrice = `$${perMonth}`
    displayPeriod = '/mo'
    billedLine = `billed $${yearlyPrice}/year`
    savingsBadge = `Save $${savings}/yr`
  }

  // Send every tier to the subscriptions page inside the app's Account section.
  // /account is Clerk-protected, so a signed-out visitor is bounced to sign-in
  // and returned here afterwards (see app/_auth/redirectDest.ts). The plan /
  // interval params let the billing page auto-open the upgrade modal.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const params = new URLSearchParams({ plan: slug })
  if (slug !== 'free') params.set('interval', interval)
  const href = `${appUrl}/account/billing?${params.toString()}`

  return (
    <div
      className="price-card"
      style={{
        background: featured ? 'var(--data-bg)' : 'var(--surface)',
        color:      featured ? 'var(--data-fg)' : 'var(--fg-1)',
        border:     featured ? '1px solid var(--data-bg)' : '1px solid var(--border)',
        borderRadius: 14,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        position: 'relative',
        transform: featured ? 'translateY(-8px)' : 'none',
        boxShadow: featured ? '0 30px 60px -20px rgba(11,11,12,0.45)' : 'none',
        transition: 'box-shadow 200ms var(--ease-out)',
      }}
    >
      {featured && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            right: 20,
            background: 'var(--buzz-500)',
            color: '#fff',
            font: '600 10px var(--font-sans)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            padding: '5px 10px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BuzzDot size={6} /> Most popular
        </div>
      )}

      <div>
        <div
          style={{
            font: '600 11px var(--font-sans)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: featured ? 'var(--data-amber)' : 'var(--fg-3)',
            marginBottom: 6,
          }}
        >
          {tier}
        </div>
        <div
          style={{
            font: '400 13px/1.5 var(--font-sans)',
            color: featured ? 'var(--data-dim)' : 'var(--fg-3)',
          }}
        >
          {tagline}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              font: '600 52px/1 var(--font-mono)',
              letterSpacing: '-0.02em',
            }}
          >
            {displayPrice}
          </span>
          <span
            style={{
              font: '500 14px var(--font-mono)',
              color: featured ? 'var(--data-dim)' : 'var(--fg-3)',
            }}
          >
            {displayPeriod}
          </span>
          {savingsBadge && (
            <span
              style={{
                marginLeft: 8,
                background: 'var(--buzz-500)',
                color: '#fff',
                font: '600 10px var(--font-sans)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '3px 7px',
                borderRadius: 4,
                alignSelf: 'center',
              }}
            >
              {savingsBadge}
            </span>
          )}
        </div>
        {billedLine && (
          <div
            style={{
              font: '400 12px var(--font-sans)',
              color: featured ? 'var(--data-dim)' : 'var(--fg-3)',
              marginTop: 4,
            }}
          >
            {billedLine}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: featured ? 'var(--data-line)' : 'var(--border)' }} />

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {features.map(f => (
          <li
            key={f}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              font: '400 14px/1.4 var(--font-sans)',
              color: featured ? 'var(--data-fg)' : 'var(--fg-1)',
            }}
          >
            <Icon
              name="check"
              size={14}
              style={{
                marginTop: 3,
                color: featured ? 'var(--data-amber)' : 'var(--buzz-500)',
                flexShrink: 0,
              }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ flex: 1 }} />

      <Button
        variant={featured ? 'inverse' : 'secondary'}
        size="md"
        iconRight="arrowR"
        href={href}
      >
        {cta}
      </Button>
    </div>
  )
}

export default function Pricing() {
  const [interval, setInterval] = useState<Interval>('month')

  return (
    <section id="pricing" style={{ padding: '96px 32px 64px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          className="pricing-header"
          style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, marginBottom: 48 }}
        >
          <div>
            <div
              style={{
                font: '600 12px/1.2 var(--font-sans)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--fg-2)',
                marginBottom: 16,
              }}
            >
              Pricing
            </div>
            <h2
              style={{
                font: '600 40px/1.05 var(--font-sans)',
                letterSpacing: '-0.018em',
                color: 'var(--fg-1)',
                margin: 0,
              }}
            >
              Three plans.<br />One number.
            </h2>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <div
              style={{
                font: '400 17px/1.55 var(--font-sans)',
                color: 'var(--fg-2)',
                maxWidth: 520,
                marginBottom: 24,
              }}
            >
              Pay monthly or save with a yearly plan. Cancel anytime. No &quot;contact sales&quot; tier.
              The Free plan covers a hobby; Pro covers a position; Alpha covers a desk.
            </div>

            {/* Billing interval toggle */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              {(['month', 'year'] as Interval[]).map(opt => {
                const active = interval === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterval(opt)}
                    style={{
                      font: '600 13px var(--font-sans)',
                      letterSpacing: '-0.005em',
                      padding: '7px 18px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 160ms cubic-bezier(0.2, 0.7, 0.2, 1)',
                      background: active ? 'var(--inv-bg)' : 'transparent',
                      color: active ? 'var(--inv-fg)' : 'var(--fg-2)',
                    }}
                  >
                    {opt === 'month' ? 'Monthly' : 'Yearly'}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div
          className="pricing-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {PLANS.map(plan => (
            <PriceCard key={plan.tier} plan={plan} interval={interval} />
          ))}
        </div>
      </div>
    </section>
  )
}
