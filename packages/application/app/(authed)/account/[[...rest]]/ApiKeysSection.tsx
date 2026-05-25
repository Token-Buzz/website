'use client'

import { useEffect, useState } from 'react'
import { TextField } from '@/app/_auth/TextField'
import { ContinueButton } from '@/app/_auth/ContinueButton'

interface KeyStatus {
  provider: string
  configured: boolean
  last4: string | null
  validatedAt: string | null
  status: 'active' | 'invalid' | null
  backgroundPolling: boolean
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ApiKeysSection() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Entry form state
  const [apiKey, setApiKey] = useState('')
  const [keyVisible, setKeyVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)

  // Remove state
  const [removing, setRemoving] = useState(false)

  // Background polling toggle state
  const [togglingPolling, setTogglingPolling] = useState(false)
  const [pollingError, setPollingError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/account/keys')
      .then((r) => r.json())
      .then((data: KeyStatus) => {
        if (!cancelled) {
          setKeyStatus(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setFieldError(undefined)
    setSubmitting(true)
    try {
      const res = await fetch('/api/account/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json() as KeyStatus & { error?: string }
      if (!res.ok) {
        setFieldError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSubmitSuccess(true)
      setApiKey('')
      setTimeout(() => {
        setSubmitSuccess(false)
        setSubmitting(false)
        setKeyStatus(data)
      }, 900)
    } catch {
      setFieldError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetch('/api/account/keys/twitter', { method: 'DELETE' })
      setKeyStatus((prev) => prev ? { ...prev, configured: false, last4: null, validatedAt: null, status: null } : prev)
    } finally {
      setRemoving(false)
    }
  }

  async function handleTogglePolling(newValue: boolean) {
    if (!keyStatus) return
    setPollingError(undefined)

    // Optimistic update
    setKeyStatus((prev) => prev ? { ...prev, backgroundPolling: newValue } : prev)
    setTogglingPolling(true)

    try {
      const res = await fetch('/api/account/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundPolling: newValue }),
      })
      const data = await res.json() as KeyStatus & { error?: string }
      if (!res.ok) {
        // Revert optimistic change
        setKeyStatus((prev) => prev ? { ...prev, backgroundPolling: !newValue } : prev)
        setPollingError(data.error ?? 'Failed to update setting. Please try again.')
      } else {
        setKeyStatus(data)
      }
    } catch {
      // Revert optimistic change
      setKeyStatus((prev) => prev ? { ...prev, backgroundPolling: !newValue } : prev)
      setPollingError('Network error. Please try again.')
    } finally {
      setTogglingPolling(false)
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-small)' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 style={{
          margin: 0,
          font: '600 var(--fs-h4) / var(--lh-snug) var(--font-sans)',
          color: 'var(--fg-1)',
          letterSpacing: '-0.015em',
        }}>
          API Keys
        </h2>
        <p style={{
          margin: 'var(--sp-2) 0 0',
          font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
          color: 'var(--fg-3)',
        }}>
          Connect your own twitterapi.io API key to run queries on your own quota.
        </p>
      </div>

      {keyStatus?.configured ? (
        /* ── Configured card ── */
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)',
          padding: 'var(--sp-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
            <span style={{
              font: '600 var(--fs-small) / 1 var(--font-sans)',
              color: 'var(--fg-1)',
              letterSpacing: '-0.005em',
            }}>
              twitterapi.io
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-small)',
              color: 'var(--fg-2)',
              letterSpacing: '0.04em',
            }}>
              •••• {keyStatus.last4}
            </span>
          </div>

          {keyStatus.status === 'invalid' && (
            <p style={{
              margin: 0,
              font: '500 var(--fs-small) / var(--lh-body) var(--font-sans)',
              color: 'var(--neg)',
            }}>
              This key was rejected — please remove it and re-enter a valid one.
            </p>
          )}

          {keyStatus.validatedAt && (
            <p style={{
              margin: 0,
              font: '400 var(--fs-micro) / 1 var(--font-sans)',
              color: 'var(--fg-3)',
            }}>
              Validated {formatDate(keyStatus.validatedAt)}
            </p>
          )}

          {/* ── Background polling toggle ── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--sp-3)',
            marginTop: 'var(--sp-1)',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--sp-3)',
              cursor: togglingPolling ? 'not-allowed' : 'pointer',
              opacity: togglingPolling ? 0.6 : 1,
            }}>
              <span style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
                <input
                  type="checkbox"
                  checked={keyStatus.backgroundPolling}
                  disabled={togglingPolling}
                  onChange={(e) => handleTogglePolling(e.target.checked)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-strong)',
                    background: keyStatus.backgroundPolling ? 'var(--accent)' : 'var(--surface-2, var(--surface))',
                    cursor: togglingPolling ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'background 0.15s, border-color 0.15s',
                    display: 'block',
                    position: 'relative',
                  }}
                  aria-label="Use my key for background polling"
                />
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: keyStatus.backgroundPolling ? '19px' : '3px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: 'white',
                  pointerEvents: 'none',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                }} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{
                  font: '500 var(--fs-small) / 1 var(--font-sans)',
                  color: 'var(--fg-1)',
                }}>
                  Use my key for background polling
                </span>
                <span style={{
                  font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
                  color: 'var(--fg-3)',
                }}>
                  When on, TokenBuzz uses your key to refresh your watchlist tokens in the background — even when you&apos;re away.
                </span>
              </span>
            </label>
            {pollingError && (
              <p style={{
                margin: 'var(--sp-2) 0 0',
                font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
                color: 'var(--neg)',
              }}>
                {pollingError}
              </p>
            )}
          </div>

          <div style={{ marginTop: 'var(--sp-2)' }}>
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-2)',
                padding: '8px 14px',
                font: '500 var(--fs-small) var(--font-sans)',
                color: removing ? 'var(--fg-3)' : 'var(--neg)',
                cursor: removing ? 'not-allowed' : 'pointer',
                opacity: removing ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {removing ? 'Removing…' : 'Remove key'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Entry form ── */
        <form onSubmit={handleSave} className="tb-form">
          <TextField
            label="twitterapi.io API key"
            type={keyVisible ? 'text' : 'password'}
            value={apiKey}
            onChange={(v) => { setApiKey(v); setFieldError(undefined) }}
            placeholder="Enter your API key"
            autoComplete="off"
            error={fieldError}
            onTogglePassword={() => setKeyVisible((v) => !v)}
            passwordVisible={keyVisible}
            disabled={submitting || submitSuccess}
          />
          <ContinueButton
            label="Validate & save"
            loading={submitting && !submitSuccess}
            success={submitSuccess}
            disabled={!apiKey.trim()}
          />
        </form>
      )}
    </div>
  )
}
