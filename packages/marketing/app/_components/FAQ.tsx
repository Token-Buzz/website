'use client'

import { useState } from 'react'
import Icon from './Icon'

const FAQ_DATA = [
  {
    q: 'What data sources do you use?',
    a: 'Right now: every public post on X mentioning your tracked tokens, keywords, or handles — 412k accounts ranked by historical accuracy. We add new handles automatically when they start moving markets. We do not scrape private channels or DMs.',
  },
  {
    q: 'How does the AI assistant work?',
    a: "Hum reads the same firehose you see — every relevant post in your selected window — and produces a short, sourced summary. It cites handles, links posts, and refuses questions it can't answer. It's a research tool, not a fortune teller. Trained on 18 months of post-and-price data; uses your live buzz feed as context.",
  },
  {
    q: 'Is there a free trial of Pro and Alpha?',
    a: "Yes. Pro and Alpha both include a 14-day trial — no card required to start. You'll get the email reminder 3 days out; we'd rather you bounce than auto-charge.",
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, in one click from your account page. We do not hide the button. No annual contracts, no exit interviews, no win-back emails. Your data exports on the way out.',
  },
  {
    q: 'Do you support tokens outside the top 100?',
    a: 'Yes — that\'s most of what people track here. If a ticker has at least 50 mentions per day on X, we cover it. You can also track keywords, narratives, or handles directly (e.g. "AI agents" or @hsaka), independent of any one token.',
  },
  {
    q: 'What about platforms beyond X — Farcaster, Discord, Reddit?',
    a: "Farcaster is in private beta — Alpha customers can opt in today. Public Discord and Telegram channels are on the roadmap for Q3. Reddit is unlikely; the signal-to-noise ratio is rough. We'll add platforms when we can do them well, not before.",
  },
]

interface FAQItemProps {
  q: string
  a: string
  open: boolean
  onToggle: () => void
}

function FAQItem({ q, a, open, onToggle }: FAQItemProps) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '20px 0' }}>
      <button
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--fg-1)',
        }}
      >
        <span
          style={{
            font: '600 19px/1.35 var(--font-sans)',
            letterSpacing: '-0.01em',
          }}
        >
          {q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '1px solid var(--border-strong)',
            display: 'grid',
            placeItems: 'center',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms var(--ease-out)',
            color: 'var(--fg-1)',
          }}
        >
          <Icon name="arrowDown" size={16} />
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 320 : 0,
          overflow: 'hidden',
          transition: 'max-height 320ms var(--ease-in-out), opacity 200ms var(--ease-out)',
          opacity: open ? 1 : 0,
        }}
      >
        <div
          style={{
            font: '400 15px/1.6 var(--font-sans)',
            color: 'var(--fg-2)',
            paddingTop: 14,
            maxWidth: 760,
          }}
        >
          {a}
        </div>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [open, setOpen] = useState<number>(0)

  return (
    <section id="faq" style={{ padding: '32px 32px 96px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          className="faq-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 64,
            alignItems: 'start',
          }}
        >
          <div style={{ position: 'sticky', top: 96 }}>
            <div
              style={{
                font: '600 12px/1.2 var(--font-sans)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--fg-2)',
                marginBottom: 16,
              }}
            >
              FAQ
            </div>
            <h2
              style={{
                font: '600 40px/1.05 var(--font-sans)',
                letterSpacing: '-0.018em',
                color: 'var(--fg-1)',
                margin: 0,
              }}
            >
              The questions we keep getting.
            </h2>
            <div
              style={{
                font: '400 15px/1.55 var(--font-sans)',
                color: 'var(--fg-2)',
                marginTop: 20,
              }}
            >
              Couldn't find what you needed? Email{' '}
              <a
                href="mailto:hello@tokenbuzz.app"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                hello@tokenbuzz.app
              </a>
              {' '}— we read everything.
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)' }}>
            {FAQ_DATA.map((item, i) => (
              <FAQItem
                key={i}
                q={item.q}
                a={item.a}
                open={open === i}
                onToggle={() => setOpen(open === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
