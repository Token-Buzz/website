'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton, SignOutButton } from '@clerk/nextjs'
import { Icon, Button, Eyebrow, BuzzDot, Avatar } from './primitives'
import type { WatchlistGroup } from './types'

// ── Sidebar nav items ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Today',     icon: 'home'     as const, href: '/dashboard' },
  { id: 'watchlist', label: 'Watchlist', icon: 'table'    as const, href: '/watchlist', count: '6' },
  { id: 'movers',    label: 'Movers',    icon: 'movers'   as const, href: '/movers' },
  { id: 'feed',      label: 'Live feed', icon: 'activity' as const, href: '/feed' },
  { id: 'alerts',    label: 'Alerts',    icon: 'bell'     as const, href: '/alerts', count: '3' },
  { id: 'analytics', label: 'Analytics', icon: 'trend'    as const, href: '/analytics' },
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
  icon: 'home' | 'table' | 'movers' | 'activity' | 'bell' | 'trend'
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
            onClick={() => setOpen(false)}
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

// ── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({
  activeWatchlist,
  setActiveWatchlist,
}: {
  activeWatchlist: string
  setActiveWatchlist: (id: string) => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const activeNav = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id ?? 'dashboard'

  return (
    <aside style={{
      width: 240, height: '100%', padding: '16px 12px',
      borderRight: '1px solid var(--border)', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0,
    }}>
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
        color: 'var(--fg-3)', font: '500 12px var(--font-sans)', cursor: 'pointer',
      }}>
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
            onClick={() => router.push(item.href)}
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
              onClick={() => setActiveWatchlist(g.id)}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Profile footer */}
      <ProfileFooter />
    </aside>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────────────

const TIME_WINDOWS = ['1H', '4H', '24H', '7D'] as const
export type TimeWindow = typeof TIME_WINDOWS[number]

function TopBar({
  timeWindow,
  setTimeWindow,
  humOpen,
  onAskHum,
}: {
  timeWindow: TimeWindow
  setTimeWindow: (w: TimeWindow) => void
  humOpen: boolean
  onAskHum: () => void
}) {
  return (
    <header style={{
      height: 56, padding: '0 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-translucent)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
    }}>
      {/* Live ticker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 16, borderRight: '1px solid var(--border)' }}>
        <BuzzDot />
        <span style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>Live</span>
        <span style={{ font: '500 12px var(--font-mono)', color: 'var(--fg-3)' }}>2,140 mentions/m · 412 handles</span>
      </div>

      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 480, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 32,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
        color: 'var(--fg-3)',
      }}>
        <Icon name="search" size={14} />
        <input
          placeholder="Search tokens, handles, narratives..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            font: '500 13px var(--font-sans)', color: 'var(--fg-1)',
          }}
        />
      </div>

      {/* Time window */}
      <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, gap: 2 }}>
        {TIME_WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setTimeWindow(w)}
            style={{
              border: 'none', padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
              font: '600 11px var(--font-sans)',
              background: timeWindow === w ? 'var(--bg-elevated)' : 'transparent',
              color: timeWindow === w ? 'var(--fg-1)' : 'var(--fg-2)',
              boxShadow: timeWindow === w ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            }}
          >{w}</button>
        ))}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" icon="bell">3</Button>
        <Button
          variant={humOpen ? 'secondary' : 'primary'}
          size="sm"
          icon="sparkle"
          onClick={onAskHum}
        >
          {humOpen ? 'Hum open' : 'Ask Hum'}
        </Button>
      </div>
    </header>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeWatchlist, setActiveWatchlist] = useState('memecoins')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24H')
  const [humOpen, setHumOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar activeWatchlist={activeWatchlist} setActiveWatchlist={setActiveWatchlist} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          timeWindow={timeWindow}
          setTimeWindow={setTimeWindow}
          humOpen={humOpen}
          onAskHum={() => setHumOpen((v) => !v)}
        />
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
