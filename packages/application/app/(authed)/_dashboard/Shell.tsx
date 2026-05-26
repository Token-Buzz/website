'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton, SignOutButton, useClerk } from '@clerk/nextjs'
import { Icon, Button, Eyebrow, Avatar } from './primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'
import { HumPanel } from './HumPanel'
import type { WatchlistGroup } from './types'
import { CommandPalette } from './CommandPalette'
import type { CommandSection } from './CommandPalette'
import { HUM_OPEN_EVENT } from './humContext'
import type { Dashboard } from '@monorepo-template/core/db/dashboards'
import { swatchForId } from './commandSwatch'

// ── Sidebar nav items ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Today',      icon: 'home'       as const, href: '/dashboard' },
  { id: 'watchlist',  label: 'Watchlist',  icon: 'table'      as const, href: '/watchlist', count: '6' },
  { id: 'dashboards', label: 'Dashboards', icon: 'grid'       as const, href: '/dashboards' },
  { id: 'movers',     label: 'Movers',     icon: 'movers'     as const, href: '/movers' },
  { id: 'feed',       label: 'Live feed',  icon: 'activity'   as const, href: '/live-feed' },
  { id: 'alerts',     label: 'Alerts',     icon: 'bell'       as const, href: '/alerts', count: '3' },
  { id: 'analytics',  label: 'Analytics',  icon: 'trend'      as const, href: '/analytics' },
]

const DEFAULT_WATCHLISTS: WatchlistGroup[] = [
  { id: 'memecoins', name: 'Memecoins',       count: 12, color: 'var(--buzz-500)' },
  { id: 'l1s',       name: 'L1s',             count: 8,  color: '#6E5BA3' },
  { id: 'defi',      name: 'DeFi blue chips', count: 14, color: '#2E7F7B' },
  { id: 'vc',        name: 'VC narratives',   count: 6,  color: '#B8527E' },
  { id: 'ai',        name: 'AI agents',       count: 9,  color: '#C68A2E' },
]

// ── NavItem ────────────────────────────────────────────────────────────────

function NavItem({
  icon, label, active, count, onClick,
}: {
  icon: 'home' | 'table' | 'grid' | 'movers' | 'activity' | 'bell' | 'trend'
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

// ── WatchlistItem ──────────────────────────────────────────────────────────

function WatchlistItem({
  group, active, onClick,
}: {
  group: WatchlistGroup
  active: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
        background: active ? 'var(--surface-active)' : 'transparent',
        color: 'var(--fg-1)', font: '500 13px/1 var(--font-sans)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 1, background: group.color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{group.name}</span>
      <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--fg-3)' }}>{group.count}</span>
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
  activeWatchlist,
  setActiveWatchlist,
  onNavClick,
  onSearch,
}: {
  activeWatchlist: string
  setActiveWatchlist: (id: string) => void
  onNavClick?: () => void
  onSearch?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const activeNav = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id ?? 'dashboard'

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
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeNav === item.id}
            count={item.count}
            onClick={() => {
              router.push(item.href)
              onNavClick?.()
            }}
          />
        ))}
      </div>

      {/* Watchlists */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 6px' }}>
          <Eyebrow>Watchlists</Eyebrow>
          <Icon name="plus" size={14} style={{ color: 'var(--fg-3)', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {DEFAULT_WATCHLISTS.map((g) => (
            <WatchlistItem
              key={g.id}
              group={g}
              active={activeWatchlist === g.id}
              onClick={() => {
                setActiveWatchlist(g.id)
                onNavClick?.()
              }}
            />
          ))}
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
  activeWatchlist,
  setActiveWatchlist,
  onSearch,
}: {
  activeWatchlist: string
  setActiveWatchlist: (id: string) => void
  onSearch?: () => void
}) {
  return (
    <aside style={{
      width: 240, height: '100%', padding: '16px 12px',
      borderRight: '1px solid var(--border)', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0,
    }}>
      <SidebarContent
        activeWatchlist={activeWatchlist}
        setActiveWatchlist={setActiveWatchlist}
        onSearch={onSearch}
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
  activeWatchlist,
  setActiveWatchlist,
  onSearch,
}: {
  open: boolean
  onClose: () => void
  activeWatchlist: string
  setActiveWatchlist: (id: string) => void
  onSearch?: () => void
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
          activeWatchlist={activeWatchlist}
          setActiveWatchlist={setActiveWatchlist}
          onNavClick={onClose}
          onSearch={onSearch}
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
}: {
  humOpen: boolean
  onAskHum: () => void
  isMobile: boolean
  onMenuOpen: () => void
  onSearch: () => void
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
            <button
              aria-label="Quick add"
              style={{
                display: 'flex', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--fg-3)', cursor: 'pointer', lineHeight: 0,
                padding: '6px 8px',
              }}
            >
              <Icon name="plus" size={14} />
            </button>

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
            <button
              aria-label="Quick add"
              style={{
                display: 'flex', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--fg-3)', cursor: 'pointer', lineHeight: 0,
                padding: '5px 8px',
              }}
            >
              <Icon name="plus" size={14} />
            </button>

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
}: {
  open: boolean
  onClose: () => void
  isMobile: boolean
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
        <HumPanel open={open} onClose={onClose} />
      </div>
    </>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeWatchlist, setActiveWatchlist] = useState('memecoins')
  const [humOpen, setHumOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])

  const isMobile = useIsMobile()
  const router = useRouter()
  const { signOut } = useClerk()

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

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

  const paletteSections: CommandSection[] = useMemo(() => [
    {
      id: 'navigate',
      heading: 'Navigate',
      items: NAV_ITEMS.map((item) => ({
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
      items: [
        {
          id: 'new-dashboard',
          label: 'New dashboard',
          icon: 'plus' as const,
          onSelect: () => router.push('/dashboards'),
        },
        {
          id: 'ask-hum',
          label: 'Ask Hum',
          icon: 'sparkle' as const,
          onSelect: () => setHumOpen(true),
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
      ],
    },
  ], [dashboards, router, signOut])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop persistent sidebar — hidden on mobile */}
      {!isMobile && (
        <Sidebar
          activeWatchlist={activeWatchlist}
          setActiveWatchlist={setActiveWatchlist}
          onSearch={openPalette}
        />
      )}

      {/* Mobile drawer overlay — only rendered when mobile */}
      {isMobile && (
        <MobileDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          activeWatchlist={activeWatchlist}
          setActiveWatchlist={setActiveWatchlist}
          onSearch={openPalette}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          humOpen={humOpen}
          onAskHum={() => setHumOpen((v) => !v)}
          isMobile={isMobile}
          onMenuOpen={openDrawer}
          onSearch={openPalette}
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
          onSelect: () => setHumOpen(true),
        })}
      />
    </div>
  )
}
