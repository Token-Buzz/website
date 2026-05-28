'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface NotificationPrefs {
  emailAlerts: boolean
}

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/account/notifications')
      .then((r) => r.json())
      .then((data: NotificationPrefs) => {
        if (!cancelled) {
          setPrefs(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load notification settings.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle(newValue: boolean) {
    if (!prefs) return
    setToggleError(undefined)

    // Optimistic update
    setPrefs((prev) => (prev ? { ...prev, emailAlerts: newValue } : prev))
    setToggling(true)

    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAlerts: newValue }),
      })
      const data = (await res.json()) as NotificationPrefs & { error?: string }
      if (!res.ok) {
        // Revert optimistic change
        setPrefs((prev) => (prev ? { ...prev, emailAlerts: !newValue } : prev))
        setToggleError(data.error ?? 'Failed to update setting. Please try again.')
      } else {
        setPrefs(data)
      }
    } catch {
      // Revert optimistic change
      setPrefs((prev) => (prev ? { ...prev, emailAlerts: !newValue } : prev))
      setToggleError('Network error. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-small)' }}>
        Loading…
      </div>
    )
  }

  if (error || !prefs) {
    return (
      <div style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-small)' }}>
        {error ?? "Couldn't load your notification settings. Refresh the page to try again."}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <h2
          style={{
            margin: 0,
            font: '600 var(--fs-h4) / var(--lh-snug) var(--font-sans)',
            color: 'var(--fg-1)',
            letterSpacing: '-0.015em',
          }}
        >
          Notifications
        </h2>
        <p
          style={{
            margin: 'var(--sp-2) 0 0',
            font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
            color: 'var(--fg-3)',
          }}
        >
          Control how TokenBuzz notifies you when your alert rules fire.
        </p>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)',
          padding: 'var(--sp-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}
      >
        {/* ── Email alerts toggle ── */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--sp-3)',
            cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          <span style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
            <input
              type="checkbox"
              checked={prefs.emailAlerts}
              disabled={toggling}
              onChange={(e) => handleToggle(e.target.checked)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-strong)',
                background: prefs.emailAlerts
                  ? 'var(--accent)'
                  : 'var(--surface-2, var(--surface))',
                cursor: toggling ? 'not-allowed' : 'pointer',
                outline: 'none',
                transition: 'background 0.15s, border-color 0.15s',
                display: 'block',
                position: 'relative',
              }}
              aria-label="Email me when an alert triggers"
            />
            <span
              style={{
                position: 'absolute',
                top: '3px',
                left: prefs.emailAlerts ? '19px' : '3px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: 'white',
                pointerEvents: 'none',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              }}
            />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                font: '500 var(--fs-small) / 1 var(--font-sans)',
                color: 'var(--fg-1)',
              }}
            >
              Email me when an alert triggers
            </span>
            <span
              style={{
                font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
                color: 'var(--fg-3)',
              }}
            >
              When on, TokenBuzz sends an email to the address on your account
              whenever any of your alert rules fires.
            </span>
          </span>
        </label>

        {toggleError && (
          <p
            style={{
              margin: 0,
              font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
              color: 'var(--neg)',
            }}
          >
            {toggleError}
          </p>
        )}

        <p
          style={{
            margin: 0,
            font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
            color: 'var(--fg-3)',
          }}
        >
          Manage your alert rules on the{' '}
          <Link
            href="/alerts"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            Alerts page
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
