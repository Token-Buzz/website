import React from 'react'
import BuzzDot from './BuzzDot'
import Button from './Button'
import Icon from './Icon'

interface PriceCardProps {
  tier: string
  tagline: string
  price: string
  period: string
  features: string[]
  cta: string
  featured?: boolean
}

function PriceCard({ tier, tagline, price, period, features, cta, featured }: PriceCardProps) {
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

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            font: '600 52px/1 var(--font-mono)',
            letterSpacing: '-0.02em',
          }}
        >
          {price}
        </span>
        <span
          style={{
            font: '500 14px var(--font-mono)',
            color: featured ? 'var(--data-dim)' : 'var(--fg-3)',
          }}
        >
          {period}
        </span>
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
        href="#"
      >
        {cta}
      </Button>
    </div>
  )
}

const PLANS: PriceCardProps[] = [
  {
    tier: 'Free',
    tagline: 'For the curious. Five tokens, no card.',
    price: '$0',
    period: 'forever',
    features: [
      '5 tracked tokens',
      '1h-delayed buzz feed',
      'Daily sentiment digest',
      'Email alerts',
    ],
    cta: 'Start free',
  },
  {
    tier: 'Pro',
    tagline: 'For traders running real positions.',
    price: '$24',
    period: '/month',
    features: [
      'Unlimited tracked tokens',
      'Real-time buzz feed (12s)',
      'Full sentiment + reputation scoring',
      'Push, email, and Discord alerts',
      '30-day mention history',
      'Mobile + web apps',
    ],
    cta: 'Start tracking',
    featured: true,
  },
  {
    tier: 'Alpha',
    tagline: 'For desks, funds, and the impatient.',
    price: '$240',
    period: '/month',
    features: [
      'Everything in Pro',
      'Ask Hum — unlimited queries',
      'Custom narrative tracking',
'Team seats (up to 5)',
      '1-year mention history + CSV export',
    ],
    cta: 'Start Alpha trial',
  },
]

export default function Pricing() {
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
          <div
            style={{
              font: '400 17px/1.55 var(--font-sans)',
              color: 'var(--fg-2)',
              maxWidth: 520,
              alignSelf: 'end',
            }}
          >
            Pay monthly. Cancel anytime. No annual lock-in, no &quot;contact sales&quot; tier. The Free
            plan covers a hobby; Pro covers a position; Alpha covers a desk.
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
          {PLANS.map(plan => <PriceCard key={plan.tier} {...plan} />)}
        </div>
      </div>
    </section>
  )
}
