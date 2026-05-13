import type { Metadata } from 'next'
import Link from 'next/link'
import Wordmark from '../_components/Wordmark'
import BuzzDot from '../_components/BuzzDot'

export const metadata: Metadata = {
  title: 'Coming Soon · TokenBuzz',
}

export default function ComingSoon() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 48 }}>
          <Wordmark size={20} suffix=".APP" />
        </Link>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 14px',
            }}
          >
            <BuzzDot />
            <span
              style={{
                font: '600 11px var(--font-mono)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fg-3)',
              }}
            >
              In progress
            </span>
          </div>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(52px, 10vw, 96px)',
            lineHeight: 0.95,
            letterSpacing: '0.005em',
            textTransform: 'uppercase',
            color: 'var(--fg-1)',
            margin: '0 0 28px',
          }}
        >
          Coming<br />
          <span style={{ color: 'var(--buzz-500)' }}>Soon.</span>
        </h1>

        <p
          style={{
            font: '400 16px/1.6 var(--font-sans)',
            color: 'var(--fg-3)',
            margin: '0 0 40px',
          }}
        >
          This page is under construction. We&apos;re building something worth waiting for.
        </p>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            font: '500 13px var(--font-mono)',
            letterSpacing: '0.06em',
            color: 'var(--buzz-500)',
            textDecoration: 'none',
          }}
        >
          ← Back to home
        </Link>
      </div>
    </main>
  )
}
