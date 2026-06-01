'use client'

import { createContext, useContext, useCallback, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ── NavigationContext ──────────────────────────────────────────────────────

export interface NavCtx {
  navigate: (href: string) => void
  isNavigating: boolean
}

export const NavigationContext = createContext<NavCtx | null>(null)

// ── NavigationProvider ─────────────────────────────────────────────────────
// Provides its own useTransition-backed navigate + isNavigating.
// AppShell uses NavigationContext.Provider directly (with its own transition)
// so that sidebar, palette, and quick-add all share one progress bar.

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => { router.push(href) })
    },
    [router],
  )
  return (
    <NavigationContext.Provider value={{ navigate, isNavigating }}>
      {children}
    </NavigationContext.Provider>
  )
}

// ── useNavigate ────────────────────────────────────────────────────────────

export function useNavigate(): NavCtx {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigate must be used within NavigationProvider')
  return ctx
}
