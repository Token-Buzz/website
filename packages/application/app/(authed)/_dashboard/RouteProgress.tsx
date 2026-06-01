'use client'

import { useEffect, useRef, useState } from 'react'

// ── RouteProgress ──────────────────────────────────────────────────────────
// A fixed top progress bar (NProgress-style, no external library).
// - When `active` becomes true: after a 120ms delay, starts trickling toward 85%.
// - When `active` becomes false: snaps to 100%, then fades out and resets.
// - If `active` flips false before the 120ms delay fires, the bar never shows.

export function RouteProgress({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(1)

  // Refs for timers so we can clean up reliably.
  const delayRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAll = () => {
    if (delayRef.current)   { clearTimeout(delayRef.current);   delayRef.current = null }
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
    if (fadeRef.current)    { clearTimeout(fadeRef.current);    fadeRef.current = null }
  }

  useEffect(() => {
    if (active) {
      // Cancel any in-progress teardown.
      clearAll()

      // Wait 120ms before showing — avoids flash on fast navigations.
      delayRef.current = setTimeout(() => {
        setWidth(8)
        setOpacity(1)
        setVisible(true)

        // Trickle: increment by a decaying amount toward 85%.
        trickleRef.current = setInterval(() => {
          setWidth((prev) => {
            if (prev >= 85) return prev
            // Decay: bigger jumps early, smaller near 85.
            const remaining = 85 - prev
            const increment = Math.max(0.5, remaining * 0.08)
            return Math.min(85, prev + increment)
          })
        }, 200)
      }, 120)
    } else {
      // Cancel the delay if active turned false before it fired.
      if (delayRef.current) {
        clearTimeout(delayRef.current)
        delayRef.current = null
      }
      // Cancel trickle.
      if (trickleRef.current) {
        clearInterval(trickleRef.current)
        trickleRef.current = null
      }

      // Only animate out if we were actually showing.
      if (visible || width > 0) {
        // Snap to 100% via a timer so setState is in a callback, not sync in the effect body.
        fadeRef.current = setTimeout(() => {
          setWidth(100)
          setOpacity(1)

          // Then fade out.
          fadeRef.current = setTimeout(() => {
            setOpacity(0)
            // Reset after fade transition completes (~200ms).
            fadeRef.current = setTimeout(() => {
              setVisible(false)
              setWidth(0)
              setOpacity(1)
            }, 220)
          }, 80)
        }, 0)
      }
    }

    return () => {
      // Cleanup on unmount or before next effect run.
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Unmount cleanup.
  useEffect(() => () => { clearAll() }, [])

  if (!visible && width === 0) return null

  return (
    <div
      className="tb-progress-bar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${width}%`,
        height: 2,
        zIndex: 1000,
        background: 'var(--accent)',
        boxShadow: '0 0 8px var(--accent)',
        opacity,
        transition: 'width 200ms ease, opacity 200ms ease',
        pointerEvents: 'none',
      }}
    />
  )
}
