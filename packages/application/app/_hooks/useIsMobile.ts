'use client'

import { useState, useEffect } from 'react'

// ── useIsMobile ────────────────────────────────────────────────────────────
// SSR-safe: initialises to false (desktop) so the first server render matches.
// Corrects on mount via matchMedia. 768px breakpoint.

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    // Use a one-shot listener on the mq itself to read the initial value
    // without calling setState synchronously in the effect body.
    const initHandler = () => setIsMobile(mq.matches)
    queueMicrotask(initHandler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
