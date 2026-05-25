'use client'

import { usePathname } from 'next/navigation'
import Wordmark from './Wordmark'
import Button from './Button'

const NAV_LINKS = [
  { label: 'Features',  href: '#features',  isSection: true },
  { label: 'Pricing',   href: '#pricing',   isSection: true },
  { label: 'FAQ',       href: '#faq',        isSection: true },
  { label: 'Changelog', href: '/changelog', isSection: false },
]

export default function Nav() {
  const pathname = usePathname()
  const onHome = pathname === '/'

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '14px 32px',
        background: 'var(--bg-translucent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <a href={onHome ? '#' : '/'} style={{ textDecoration: 'none' }}>
        <Wordmark size={18} suffix=".APP" />
      </a>

      <div style={{ flex: 1 }} />

      <div className="nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {NAV_LINKS.map(({ label, href, isSection }) => (
          <a
            key={label}
            href={isSection && !onHome ? `/${href}` : href}
            style={{
              font: '500 14px var(--font-sans)',
              color: 'var(--fg-2)',
              textDecoration: 'none',
              letterSpacing: '-0.005em',
            }}
          >
            {label}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="link" size="md" style={{ padding: '10px 12px' }} href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-in`}>
          Sign in
        </Button>
        <Button variant="primary" size="md" iconRight="arrowR" href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-up`}>
          Get started
        </Button>
      </div>
    </nav>
  )
}
