'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Wordmark from './Wordmark'
import Button from './Button'

const NAV_LINKS = [
  { label: 'Features',  href: '#features',  isSection: true,  external: false },
  { label: 'Pricing',   href: '#pricing',   isSection: true,  external: false },
  { label: 'FAQ',       href: '#faq',        isSection: true,  external: false },
  { label: 'Docs',      href: 'https://runtimedesigns.gitbook.io/token-buzz', isSection: false, external: true },
  { label: 'Changelog', href: '/changelog', isSection: false, external: false },
]

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="7"  x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const onHome = pathname === '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  function close() { setMenuOpen(false) }

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function linkHref(href: string, isSection: boolean) {
    return isSection && !onHome ? `/${href}` : href
  }

  return (
    <>
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
          {NAV_LINKS.map(({ label, href, isSection, external }) => (
            <a
              key={label}
              href={linkHref(href, isSection)}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
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

        <div className="nav-desktop-auth" style={{ display: 'flex', gap: 8 }}>
          <Button variant="link" size="md" style={{ padding: '10px 12px' }} href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-in`}>
            Sign in
          </Button>
          <Button variant="primary" size="md" iconRight="arrowR" href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-up`}>
            Get started
          </Button>
        </div>

        <button
          className="nav-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <HamburgerIcon />
        </button>
      </nav>

      <div className={`nav-mobile-panel${menuOpen ? ' open' : ''}`} aria-modal="true" role="dialog" aria-label="Navigation menu">
        <div className="nav-mobile-overlay" onClick={close} />
        <div className="nav-mobile-sheet" ref={panelRef}>
          <div className="nav-mobile-header">
            <Wordmark size={16} suffix=".APP" />
            <button className="nav-mobile-close" aria-label="Close navigation menu" onClick={close}>
              <CloseIcon />
            </button>
          </div>

          {NAV_LINKS.map(({ label, href, isSection, external }) => (
            <a
              key={label}
              href={linkHref(href, isSection)}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="nav-mobile-link"
              onClick={close}
            >
              {label}
            </a>
          ))}

          <div className="nav-mobile-divider" />

          <div className="nav-mobile-auth">
            <Button
              variant="ghost"
              size="md"
              href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-in`}
              style={{ justifyContent: 'center' }}
            >
              Sign in
            </Button>
            <Button
              variant="primary"
              size="md"
              iconRight="arrowR"
              href={`${process.env.NEXT_PUBLIC_APP_URL}/sign-up`}
              style={{ justifyContent: 'center' }}
            >
              Get started
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
