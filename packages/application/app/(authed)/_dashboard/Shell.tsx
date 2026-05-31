'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton, SignOutButton, useClerk } from '@clerk/nextjs'
import { Icon, Button, Eyebrow, Avatar } from './primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { HumPanel } from './HumPanel'
import { CommandPalette } from './CommandPalette'
import type { CommandItem, CommandSection } from './CommandPalette'
import { pickById } from './commandRegistry'
import { QuickAddMenu } from './QuickAddMenu'
import { HUM_OPEN_EVENT } from './humContext'
import type { Dashboard } from '@monorepo-template/core/db/dashboards'
import { swatchForId } from './commandSwatch'
import { UpgradeModalProvider } from '@/app/_billing/UpgradeModalProvider'
import { DunningBanner } from './DunningBanner'
import { WATCHLIST_CHANGED_EVENT } from './watchlistEvents'
import { TokenDetailPane } from './TokenDetailPane'
import type { Token } from './types'

// ── Sidebar nav items ──────────────────────────────────────────────────────

// count for watchlist is fetched on mount; omit the badge entirely when 0
const NAV_ITEMS_BASE = [
  { id: 'dashboard',  label: 'Today',      icon: 'home'       as const, href: '/dashboard' },
  { id: 'watchlist',  label: 'Watchlist',  icon: 'table'      as const, href: '/watchlist' },
  { id: 'dashboards', label: 'Dashboards', icon: 'grid'       as const, href: '/dashboards' },
  { id: 'movers',     label: 'Movers',     icon: 'movers'     as const, href: '/movers' },
  { id: 'feed',       label: 'Live feed',  icon: 'activity'   as const, href: '/live-feed' },
  { id: 'alerts',     label: 'Alerts',     icon: 'bell'       as const, href: '/alerts', count: '3' },
  { id: 'analytics',  label: 'Analytics',  icon: 'trend'      as const, href: '/analytics' },
  { id: 'history',    label: 'History',    icon: 'clock'      as const, href: '/history' },
]

// ── NavItem ────────────────────────────────────────────────────────────────

function NavItem({
  icon, label, active, count, onClick,
}: {
  icon: 'home' | 'table' | 'grid' | 'movers' | 'activity' | 'bell' | 'trend' | 'clock'
  label: string
  active: boolean
  count?: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
        background: active ? 'var(--inv-bg)' : 'transparent',
        color: active ? 'var(--inv-fg)' : 'var(--fg-2)',
        font: '500 13px/1 var(--font-sans)',
      }}
    >
      <Icon name={icon} size={16} />
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{
          font: '500 11px/1 var(--font-mono)',
          background: active ? 'rgba(255,255,255,0.12)' : 'var(--bg-sunken)',
          color: active ? 'var(--inv-fg)' : 'var(--fg-3)',
          padding: '2px 6px', borderRadius: 999,
        }}>{count}</span>
      )}
    </div>
  )
}

// ── ProfileFooter ──────────────────────────────────────────────────────────

function ProfileFooter() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <button
            onClick={() => { setOpen(false); router.push('/account') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', border: 'none', background: 'transparent',
              color: 'var(--fg-2)', font: '500 13px var(--font-sans)', cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="settings" size={14} />
            Settings
          </button>
          <a
            href="https://runtimedesigns.gitbook.io/token-buzz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', border: 'none', background: 'transparent',
              color: 'var(--fg-2)', font: '500 13px var(--font-sans)', cursor: 'pointer',
              textAlign: 'left', textDecoration: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="book" size={14} />
            Documentation
          </a>
          <div style={{ height: 1, background: 'var(--border)', margin: '0 10px' }} />
          <SignOutButton>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--error, #e05252)', font: '500 13px var(--font-sans)', cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon name="logout" size={14} />
              Log out
            </button>
          </SignOutButton>
        </div>
      )}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px',
          borderRadius: 8, background: open ? 'var(--surface-active, var(--surface))' : 'var(--surface)',
          border: '1px solid var(--border)', cursor: 'pointer',
        }}
      >
        <UserButton />
        <div style={{ flex: 1, lineHeight: 1.2 }}>
          <div style={{ font: '600 12px var(--font-sans)' }}>My Account</div>
          <div style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-3)' }}>TokenBuzz Pro</div>
        </div>
        <Icon name="chevD" size={14} style={{
          color: 'var(--fg-3)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 150ms',
        }} />
      </div>
    </div>
  )
}

// ── SidebarContent ─────────────────────────────────────────────────────────
// Extracted so it can be rendered both in the persistent aside and in the
// mobile drawer overlay without duplicating JSX.

function SidebarContent({
  watchlistEntries,
  onNavClick,
  onSearch,
  watchlistCount,
  onOpenToken,
}: {
  watchlistEntries: { entryId: string; symbol: string; query: string }[] | null
  onNavClick?: () => void
  onSearch?: () => void
  watchlistCount: number | null
  onOpenToken?: (entry: { symbol: string; query: string; entryId: string }) => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const activeNav = NAV_ITEMS_BASE.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.id ?? 'dashboard'

  return (
    <>
      {/* Logo */}
      <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          background: 'var(--inv-bg)', color: 'var(--inv-fg)',
          fontFamily: 'var(--font-display)', fontSize: 16,
          padding: '5px 9px 3px', lineHeight: 1, letterSpacing: '0.01em',
        }}>TOKENBUZZ</div>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--buzz-500)' }} />
      </div>

      {/* Search shortcut */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { onSearch?.(); onNavClick?.() }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSearch?.(); onNavClick?.() } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--fg-3)', font: '500 12px var(--font-sans)', cursor: 'pointer',
        }}
      >
        <Icon name="search" size={14} />
        <span style={{ flex: 1 }}>Search tokens</span>
        <kbd style={{ font: '500 10px var(--font-mono)', background: 'var(--ink-100)', padding: '1px 5px', borderRadius: 3 }}>⌘K</kbd>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS_BASE.map((item) => {
          // Resolve the live watchlist count for the badge; omit badge when count is 0
          const count =
            item.id === 'watchlist'
              ? watchlistCount !== null && watchlistCount > 0
                ? String(watchlistCount)
                : undefined
              : item.count
          return (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              count={count}
              onClick={() => {
                router.push(item.href)
                onNavClick?.()
              }}
            />
          )
        })}
      </div>

      {/* Watchlist */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 6px' }}>
          <Eyebrow>Watchlist</Eyebrow>
          <span
            role="button"
            tabIndex={0}
            aria-label="Add token to watchlist"
            style={{ color: 'var(--fg-3)', cursor: 'pointer', lineHeight: 0 }}
            onClick={() => { router.push('/watchlist?add=1'); onNavClick?.() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push('/watchlist?add=1')
                onNavClick?.()
              }
            }}
          >
            <Icon name="plus" size={14} />
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {watchlistEntries === null ? null : watchlistEntries.length === 0 ? (
            <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-4)', padding: '2px 10px' }}>
              No tokens yet
            </span>
          ) : (
            watchlistEntries.slice(0, 12).map((entry) => (
              <div
                key={entry.entryId}
                onClick={() => {
                  onOpenToken?.({ symbol: entry.symbol, query: entry.query, entryId: entry.entryId })
                  onNavClick?.()
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--fg-1)', font: '500 13px/1 var(--font-sans)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 1, background: swatchForId(entry.symbol), flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{entry.symbol}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Profile footer */}
      <ProfileFooter />
    </>
  )
}

// ── Sidebar (desktop persistent aside) ────────────────────────────────────

function Sidebar({
  watchlistEntries,
  onSearch,
  watchlistCount,
  onOpenToken,
}: {
  watchlistEntries: { entryId: string; symbol: string; query: string }[] | null
  onSearch?: () => void
  watchlistCount: number | null
  onOpenToken?: (entry: { symbol: string; query: string; entryId: string }) => void
}) {
  return (
    <aside style={{
      width: 240, height: '100%', padding: '16px 12px',
      borderRight: '1px solid var(--border)', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0,
    }}>
      <SidebarContent
        watchlistEntries={watchlistEntries}
        onSearch={onSearch}
        watchlistCount={watchlistCount}
        onOpenToken={onOpenToken}
      />
    </aside>
  )
}

// ── MobileDrawer ──────────────────────────────────────────────────────────
// Off-canvas overlay with backdrop scrim, slide-in animation, focus trap,
// Esc-to-close, backdrop-click-to-close, and body-scroll lock.

function MobileDrawer({
  open,
  onClose,
  watchlistEntries,
  onSearch,
  watchlistCount,
  onOpenToken,
}: {
  open: boolean
  onClose: () => void
  watchlistEntries: { entryId: string; symbol: string; query: string }[] | null
  onSearch?: () => void
  watchlistCount: number | null
  onOpenToken?: (entry: { symbol: string; query: string; entryId: string }) => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close on route change (nav tap auto-closes drawer)
  useEffect(() => {
    if (open) onClose()
    // We intentionally only react to pathname changes, not to `open` or `onClose`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Focus trap + Esc-to-close
  useEffect(() => {
    if (!open) return

    // Focus the drawer panel so keyboard users start inside it
    const drawer = drawerRef.current
    if (!drawer) return

    // Gather all focusable elements inside the drawer
    const getFocusable = (): HTMLElement[] =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null) // exclude hidden elements

    // Focus first element
    const focusables = getFocusable()
    if (focusables.length > 0) focusables[0].focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const elements = getFocusable()
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Don't unmount — keep in DOM so the slide-out animation plays.
  // Visibility via pointer-events + aria-hidden when closed.
  return (
    <>
      {/* Backdrop scrim */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!open}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          zIndex: 50,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '16px 12px',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 250ms cubic-bezier(0.32,0,0.16,1)',
          overflowY: 'auto',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {/* Close button row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--fg-2)', padding: 4, borderRadius: 4, lineHeight: 0,
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <SidebarContent
          watchlistEntries={watchlistEntries}
          onNavClick={onClose}
          onSearch={onSearch}
          watchlistCount={watchlistCount}
          onOpenToken={onOpenToken}
        />
      </div>
    </>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────────────

function TopBar({
  humOpen,
  onAskHum,
  isMobile,
  onMenuOpen,
  onSearch,
  quickAddItems,
}: {
  humOpen: boolean
  onAskHum: () => void
  isMobile: boolean
  onMenuOpen: () => void
  onSearch: () => void
  quickAddItems: CommandItem[]
}) {
  return (
    <header style={{
      height: 56, padding: isMobile ? '0 12px' : '0 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-translucent)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16,
      position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      minWidth: 0,
    }}>
      {isMobile ? (
        // ── Mobile top bar ──────────────────────────────────────────────────
        <>
          {/* Hamburger */}
          <button
            onClick={onMenuOpen}
            aria-label="Open navigation"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--fg-1)', padding: 4, borderRadius: 4,
              lineHeight: 0, flexShrink: 0,
            }}
          >
            <Icon name="menu" size={22} />
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right affordances */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Search ⌘K — icon-only on mobile */}
            <button
              aria-label="Search"
              onClick={onSearch}
              style={{
                display: 'flex', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--fg-3)', cursor: 'pointer', lineHeight: 0,
                padding: '6px 8px',
              }}
            >
              <Icon name="search" size={14} />
            </button>

            {/* Quick add — icon-only */}
            <QuickAddMenu items={quickAddItems} isMobile={true} />

            {/* Ask Hum — icon-only on mobile */}
            <button
              onClick={onAskHum}
              aria-label={humOpen ? 'Hum open' : 'Ask Hum'}
              style={{
                border: 'none', borderRadius: 4, cursor: 'pointer', lineHeight: 0,
                padding: '6px',
                background: humOpen ? 'var(--inv-bg)' : 'var(--buzz-500)',
                color: humOpen ? 'var(--inv-fg)' : '#fff',
                flexShrink: 0,
              }}
            >
              <Icon name="sparkle" size={16} />
            </button>
          </div>
        </>
      ) : (
        // ── Desktop top bar ─────────────────────────────────────────────────
        <>
          {/* Spacer — pushes right affordances to the right */}
          <div style={{ flex: 1 }} />

          {/* Right affordances */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search ⌘K */}
            <button
              aria-label="Search"
              onClick={onSearch}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--fg-3)', font: '500 12px var(--font-sans)', cursor: 'pointer',
                padding: '5px 10px',
              }}
            >
              <Icon name="search" size={14} />
              <span>Search</span>
              <kbd style={{ font: '500 10px var(--font-mono)', background: 'var(--ink-100)', padding: '1px 5px', borderRadius: 3 }}>⌘K</kbd>
            </button>

            {/* Quick add */}
            <QuickAddMenu items={quickAddItems} isMobile={false} />

            <Button
              variant={humOpen ? 'secondary' : 'primary'}
              size="sm"
              icon="sparkle"
              onClick={onAskHum}
            >
              {humOpen ? 'Hum open' : 'Ask Hum'}
            </Button>
          </div>
        </>
      )}
    </header>
  )
}

// ── HumSlideOut ────────────────────────────────────────────────────────────
// Always kept in the DOM so the slide animation plays. On mobile, renders a
// backdrop scrim and locks body scroll; on desktop it is a non-modal panel.

function HumSlideOut({
  open,
  onClose,
  isMobile,
  presetQuestion,
  onPresetConsumed,
}: {
  open: boolean
  onClose: () => void
  isMobile: boolean
  presetQuestion?: string
  onPresetConsumed?: () => void
}) {
  // Body scroll lock (mobile only)
  useEffect(() => {
    if (!isMobile) return
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, isMobile])

  // Esc-to-close
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop scrim — mobile only */}
      {isMobile && (
        <div
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 55,
            background: 'rgba(0,0,0,0.45)',
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity 250ms ease',
          }}
        />
      )}

      {/* Slide-out panel */}
      <div
        role="complementary"
        aria-label="Hum AI assistant"
        inert={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100vw)',
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 250ms cubic-bezier(0.32,0,0.16,1)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <HumPanel open={open} onClose={onClose} presetQuestion={presetQuestion} onPresetConsumed={onPresetConsumed} />
      </div>
    </>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const [humOpen, setHumOpen] = useState(false)
  const [humPreset, setHumPreset] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  // null = not yet fetched; fetched once on mount from GET /api/watchlist
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null)
  const [watchlistEntries, setWatchlistEntries] = useState<{ entryId: string; symbol: string; query: string }[] | null>(null)
  // Token detail pane — global overlay from sidebar clicks
  const [detailToken, setDetailToken] = useState<Token | null>(null)
  const [detailExpanded, setDetailExpanded] = useState(false)

  const isMobile = useIsMobile()
  const router = useRouter()
  const { signOut } = useClerk()

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  const askHum = useCallback((preset?: string) => {
    setHumPreset(preset ?? '')
    setHumOpen(true)
  }, [])

  const openTokenDetail = useCallback((entry: { symbol: string; query: string; entryId: string }) => {
    setDetailExpanded(false)
    setDetailToken({
      sym: entry.symbol, name: entry.symbol, query: entry.query,
      price: 0, d24: 0, mentions: 0, dbuzz: 0, sent: 'neu',
      spark: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      live: false, entryId: entry.entryId,
    })
  }, [])

  const closeDetail = useCallback(() => {
    setDetailToken(null)
    setDetailExpanded(false)
  }, [])

  // Fetch real watchlist entries — called on mount and whenever the watchlist changes.
  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist')
      if (!res.ok) return
      const data = (await res.json()) as { entries?: { entryId: string; symbol: string; query: string }[] }
      const mapped = (data.entries ?? []).map(({ entryId, symbol, query }) => ({ entryId, symbol, query: query ?? '' }))
      setWatchlistEntries(mapped)
      setWatchlistCount(mapped.length)
    } catch { /* best-effort; badge stays hidden on error */ }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { queueMicrotask(() => { void loadWatchlist() }) }, [])

  // Re-fetch sidebar entries whenever a watchlist mutation fires (add / delete / reorder)
  useEffect(() => {
    window.addEventListener(WATCHLIST_CHANGED_EVENT, loadWatchlist)
    return () => { window.removeEventListener(WATCHLIST_CHANGED_EVENT, loadWatchlist) }
  }, [loadWatchlist])

  // Ensure drawer closes if screen widens past breakpoint.
  // setState is called inside a microtask callback to avoid the synchronous
  // setState-in-effect lint rule.
  useEffect(() => {
    if (!isMobile && drawerOpen) {
      queueMicrotask(() => setDrawerOpen(false))
    }
  }, [isMobile, drawerOpen])

  // Global ⌘K / Ctrl+K listener to open command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Open Hum panel when context is added via menu or hum:open event
  useEffect(() => {
    function openHum() { setHumOpen(true) }
    window.addEventListener('hum:add-context', openHum)
    window.addEventListener(HUM_OPEN_EVENT, openHum)
    return () => {
      window.removeEventListener('hum:add-context', openHum)
      window.removeEventListener(HUM_OPEN_EVENT, openHum)
    }
  }, [])

  // Open Hum panel and prefill composer when a quick-ask fires from the brief card
  useEffect(() => {
    function handleAsk(e: Event) {
      const question = (e as CustomEvent<{ question: string }>).detail?.question
      if (typeof question === 'string' && question.trim()) {
        askHum(question.trim())
      }
    }
    window.addEventListener('hum:ask', handleAsk)
    return () => window.removeEventListener('hum:ask', handleAsk)
  }, [askHum])

  // Body-scroll-lock while detail pane is open on mobile
  useEffect(() => {
    if (!isMobile) return
    if (detailToken) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [detailToken, isMobile])

  // Escape-to-close detail pane
  useEffect(() => {
    if (!detailToken) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDetail()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [detailToken, closeDetail])

  // Deep-link: ?ask=<text> pre-fills the Hum composer on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const preset = params.get('ask')?.trim()
    if (preset) {
      queueMicrotask(() => askHum(preset))
      params.delete('ask')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch dashboards each time the palette opens so newly-created ones show up
  useEffect(() => {
    if (!paletteOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dashboards')
        if (!res.ok) return
        const data = (await res.json()) as { dashboards?: Dashboard[] }
        if (!cancelled) setDashboards(data.dashboards ?? [])
      } catch { /* best-effort; palette still works without dashboards */ }
    })()
    return () => { cancelled = true }
  }, [paletteOpen])

  const actionCommands: CommandItem[] = useMemo(() => [
    {
      id: 'new-dashboard',
      label: 'New dashboard',
      icon: 'plus' as const,
      onSelect: () => router.push('/dashboards?new=1'),
    },
    {
      id: 'ask-hum',
      label: 'Ask Hum',
      icon: 'sparkle' as const,
      onSelect: () => askHum(),
    },
    {
      id: 'new-alert-via-hum',
      label: 'New alert via Hum',
      icon: 'bell' as const,
      onSelect: () => askHum('Help me set up a new alert.'),
    },
    {
      id: 'open-settings',
      label: 'Open settings',
      icon: 'settings' as const,
      onSelect: () => router.push('/account'),
    },
    {
      id: 'sign-out',
      label: 'Sign out',
      icon: 'logout' as const,
      onSelect: () => void signOut(),
    },
    {
      id: 'toggle-theme',
      label: 'Toggle theme',
      icon: 'contrast' as const,
      onSelect: () => {
        const el = document.documentElement
        el.setAttribute('data-theme', el.getAttribute('data-theme') === 'light' ? 'dark' : 'light')
      },
    },
  ], [router, signOut, askHum])

  const quickAddItems: CommandItem[] = useMemo(
    () => pickById(actionCommands, ['new-dashboard', 'ask-hum', 'new-alert-via-hum']),
    [actionCommands],
  )

  const paletteSections: CommandSection[] = useMemo(() => [
    {
      id: 'navigate',
      heading: 'Navigate',
      items: NAV_ITEMS_BASE.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        onSelect: () => router.push(item.href),
      })),
    },
    {
      id: 'dashboards',
      heading: 'Dashboards',
      items: dashboards.map((d) => ({
        id: `dash-${d.dashboardId}`,
        label: d.name,
        swatch: swatchForId(d.dashboardId),
        keywords: [d.ticker, d.query].filter(Boolean).join(' '),
        onSelect: () => router.push(`/dashboards/${d.dashboardId}`),
      })),
    },
    {
      id: 'actions',
      heading: 'Actions',
      items: pickById(actionCommands, ['new-dashboard', 'ask-hum', 'open-settings', 'sign-out', 'toggle-theme']),
    },
  ], [actionCommands, dashboards, router])

  return (
    <UpgradeModalProvider>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop persistent sidebar — hidden on mobile */}
      {!isMobile && (
        <Sidebar
          watchlistEntries={watchlistEntries}
          onSearch={openPalette}
          watchlistCount={watchlistCount}
          onOpenToken={openTokenDetail}
        />
      )}

      {/* Mobile drawer overlay — only rendered when mobile */}
      {isMobile && (
        <MobileDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          watchlistEntries={watchlistEntries}
          onSearch={openPalette}
          watchlistCount={watchlistCount}
          onOpenToken={openTokenDetail}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <DunningBanner />
        <TopBar
          humOpen={humOpen}
          onAskHum={() => setHumOpen((v) => !v)}
          isMobile={isMobile}
          onMenuOpen={openDrawer}
          onSearch={openPalette}
          quickAddItems={quickAddItems}
        />
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>

      {/* Hum AI slide-out — always in DOM, slides from right edge */}
      <HumSlideOut
        open={humOpen}
        onClose={() => setHumOpen(false)}
        isMobile={isMobile}
        presetQuestion={humPreset}
        onPresetConsumed={() => setHumPreset(undefined)}
      />

      {/* Command palette overlay */}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        sections={paletteSections}
        contextual={(q) => ({
          id: 'ask-hum-about',
          label: `Ask Hum about "${q}"`,
          icon: 'sparkle',
          onSelect: () => askHum(q),
        })}
      />

      {/* Global token detail overlay — opened by clicking a sidebar watchlist entry */}
      {detailToken && isMobile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'var(--bg)', overflowY: 'auto',
        }}>
          <TokenDetailPane
            token={detailToken}
            onClose={closeDetail}
            onAskHum={askHum}
          />
        </div>
      )}
      {detailToken && !isMobile && (
        <>
          {/* Backdrop scrim */}
          <div
            aria-hidden="true"
            onClick={closeDetail}
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              background: 'rgba(0,0,0,0.3)',
            }}
          />
          {/* Right-anchored drawer */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
              width: detailExpanded ? 'min(1200px, calc(100vw - 320px))' : 680,
              maxWidth: '100vw',
              background: 'var(--bg)',
              borderLeft: '1px solid var(--border)',
              overflowY: 'auto',
              transition: 'width 180ms ease',
            }}
          >
            <TokenDetailPane
              token={detailToken}
              onClose={closeDetail}
              onAskHum={askHum}
              expanded={detailExpanded}
              onToggleExpand={() => setDetailExpanded((v) => !v)}
            />
          </div>
        </>
      )}
    </div>
    </UpgradeModalProvider>
  )
}
