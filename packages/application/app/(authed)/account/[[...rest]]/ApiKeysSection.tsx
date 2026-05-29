'use client'

import { useEffect, useState } from 'react'
import { TextField } from '@/app/_auth/TextField'
import { ContinueButton } from '@/app/_auth/ContinueButton'
import { getEnabledProviderMeta, type ProviderMeta } from './providerMeta'

// ── Types ──────────────────────────────────────────────────────────────────────

interface KeyStatus {
  provider: string
  providerName: string
  configured: boolean
  last4: string | null
  validatedAt: string | null
  status: 'active' | 'invalid' | null
  backgroundPolling: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Tab bar ────────────────────────────────────────────────────────────────────

interface TabBarProps {
  providers: ProviderMeta[]
  activeIndex: number
  onSelect: (index: number) => void
}

function TabBar({ providers, activeIndex, onSelect }: TabBarProps) {
  const count = providers.length
  return (
    <div
      role="tablist"
      aria-label="API key providers"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-3) var(--r-3) 0 0',
        position: 'relative',
        marginBottom: 'var(--sp-5)',
      }}
    >
      {providers.map((p, i) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={i === activeIndex}
          aria-controls={`tab-panel-${p.id}`}
          id={`tab-${p.id}`}
          type="button"
          onClick={() => onSelect(i)}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 0,
            padding: 'var(--sp-3) var(--sp-3)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--fs-small)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: i === activeIndex ? 'var(--fg-1)' : 'var(--fg-3)',
            cursor: 'pointer',
            transition: 'color 0.15s',
            position: 'relative',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') onSelect((i + 1) % count)
            if (e.key === 'ArrowLeft') onSelect((i - 1 + count) % count)
          }}
        >
          {p.label}
          {i === activeIndex && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--accent)',
                boxShadow: '0 0 12px -2px rgba(255,107,44,0.6)',
                borderRadius: '1px 1px 0 0',
              }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ── Toggle (background polling) ────────────────────────────────────────────────

interface PollingToggleProps {
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
  error?: string
}

function PollingToggle({ checked, disabled, onChange, error }: PollingToggleProps) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 'var(--sp-3)',
        marginTop: 'var(--sp-1)',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--sp-3)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            aria-label="Use my key for background polling"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              border: '1.5px solid var(--border-strong)',
              background: checked ? 'var(--accent)' : 'var(--surface-2, var(--surface))',
              cursor: disabled ? 'not-allowed' : 'pointer',
              outline: 'none',
              transition: 'background 0.15s, border-color 0.15s',
              display: 'block',
              position: 'relative',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '3px',
              left: checked ? '19px' : '3px',
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
            Use my key for background polling
          </span>
          <span
            style={{
              font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
              color: 'var(--fg-3)',
            }}
          >
            When on, TokenBuzz uses your key to refresh your watchlist tokens in
            the background — even when you&apos;re away.
          </span>
        </span>
      </label>
      {error && (
        <p
          style={{
            margin: 'var(--sp-2) 0 0',
            font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
            color: 'var(--neg)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// ── Instructions collapsible ───────────────────────────────────────────────────

interface InstructionsProps {
  meta: ProviderMeta
}

function Instructions({ meta }: InstructionsProps) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 0,
          padding: 0,
          font: '500 var(--fs-small) var(--font-sans)',
          color: 'var(--fg-3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          transition: 'color 0.15s',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: '10px', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        Setup instructions
      </button>
      {open && (
        <div
          style={{
            marginTop: 'var(--sp-3)',
            padding: 'var(--sp-4)',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
          }}
        >
          <ol style={{ margin: 0, padding: '0 0 0 var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {meta.instructions.map((step, i) => (
              <li
                key={i}
                style={{
                  font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
                  color: 'var(--fg-2)',
                }}
              >
                {step}
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
            <a
              href={meta.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                font: '500 var(--fs-small) var(--font-sans)',
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              {meta.docLabel} ↗
            </a>
            {meta.docUrl2 && meta.docLabel2 && (
              <a
                href={meta.docUrl2}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  font: '500 var(--fs-small) var(--font-sans)',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                {meta.docLabel2} ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Per-provider panel ─────────────────────────────────────────────────────────

interface ProviderPanelProps {
  meta: ProviderMeta
}

function ProviderPanel({ meta }: ProviderPanelProps) {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Entry form: field values keyed by field name
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(meta.fields.map((f) => [f.name, '']))
  )
  const [fieldVisible, setFieldVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(meta.fields.map((f) => [f.name, false]))
  )
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
    fetch(`/api/account/keys/${meta.id}`)
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
  }, [meta.id])

  function setField(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }))
    setFieldError(undefined)
  }

  function toggleVisible(name: string) {
    setFieldVisible((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const allFilled = meta.fields.every((f) => fieldValues[f.name]?.trim())

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!allFilled) return
    setFieldError(undefined)
    setSubmitting(true)

    // Build body from field values
    const body: Record<string, string> = {}
    for (const f of meta.fields) {
      body[f.name] = fieldValues[f.name].trim()
    }

    try {
      const res = await fetch(`/api/account/keys/${meta.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as KeyStatus & { error?: string }
      if (!res.ok) {
        setFieldError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSubmitSuccess(true)
      // Reset all field values
      setFieldValues(Object.fromEntries(meta.fields.map((f) => [f.name, ''])))
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
    if (!keyStatus) return
    setRemoving(true)
    try {
      await fetch(`/api/account/keys/${meta.id}`, { method: 'DELETE' })
      setKeyStatus((prev) =>
        prev ? { ...prev, configured: false, last4: null, validatedAt: null, status: null } : prev
      )
    } finally {
      setRemoving(false)
    }
  }

  async function handleTogglePolling(newValue: boolean) {
    if (!keyStatus) return
    setPollingError(undefined)

    // Optimistic update
    setKeyStatus((prev) => (prev ? { ...prev, backgroundPolling: newValue } : prev))
    setTogglingPolling(true)

    try {
      const res = await fetch(`/api/account/keys/${meta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundPolling: newValue }),
      })
      const data = await res.json() as KeyStatus & { error?: string }
      if (!res.ok) {
        // Revert optimistic change
        setKeyStatus((prev) => (prev ? { ...prev, backgroundPolling: !newValue } : prev))
        setPollingError(data.error ?? 'Failed to update setting. Please try again.')
      } else {
        setKeyStatus(data)
      }
    } catch {
      // Revert optimistic change
      setKeyStatus((prev) => (prev ? { ...prev, backgroundPolling: !newValue } : prev))
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

  if (!keyStatus) {
    return (
      <div style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-small)' }}>
        Couldn&apos;t load your API key settings. Refresh the page to try again.
      </div>
    )
  }

  return (
    <div>
      {keyStatus.configured ? (
        /* ── Configured card ── */
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-3)',
            }}
          >
            <span
              style={{
                font: '600 var(--fs-small) / 1 var(--font-sans)',
                color: 'var(--fg-1)',
                letterSpacing: '-0.005em',
              }}
            >
              {keyStatus.providerName}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-small)',
                color: 'var(--fg-2)',
                letterSpacing: '0.04em',
              }}
            >
              •••• {keyStatus.last4}
            </span>
          </div>

          {keyStatus.status === 'invalid' && (
            <p
              style={{
                margin: 0,
                font: '500 var(--fs-small) / var(--lh-body) var(--font-sans)',
                color: 'var(--neg)',
              }}
            >
              This key was rejected — please remove it and re-enter a valid one.
            </p>
          )}

          {keyStatus.validatedAt && (
            <p
              style={{
                margin: 0,
                font: '400 var(--fs-micro) / 1 var(--font-sans)',
                color: 'var(--fg-3)',
              }}
            >
              Validated {formatDate(keyStatus.validatedAt)}
            </p>
          )}

          <PollingToggle
            checked={keyStatus.backgroundPolling}
            disabled={togglingPolling}
            onChange={handleTogglePolling}
            error={pollingError}
          />

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
          {meta.fields.map((f, fi) => (
            <TextField
              key={f.name}
              label={f.label}
              type={f.secret ? (fieldVisible[f.name] ? 'text' : 'password') : 'text'}
              value={fieldValues[f.name] ?? ''}
              onChange={(v) => setField(f.name, v)}
              placeholder={f.placeholder}
              autoComplete="off"
              // Show the error inline on the last field for single-field forms;
              // for multi-field forms it's rendered below the fields.
              error={meta.fields.length === 1 && fi === 0 ? fieldError : undefined}
              onTogglePassword={f.secret ? () => toggleVisible(f.name) : undefined}
              passwordVisible={f.secret ? fieldVisible[f.name] : undefined}
              disabled={submitting || submitSuccess}
            />
          ))}
          {fieldError && meta.fields.length > 1 && (
            <p
              style={{
                margin: 0,
                font: '500 var(--fs-small) var(--font-sans)',
                color: 'var(--neg)',
              }}
            >
              {fieldError}
            </p>
          )}
          <ContinueButton
            label="Validate & save"
            loading={submitting && !submitSuccess}
            success={submitSuccess}
            disabled={!allFilled}
          />
        </form>
      )}
      <Instructions meta={meta} />
    </div>
  )
}

// ── Top-level section ──────────────────────────────────────────────────────────

export function ApiKeysSection() {
  const providers = getEnabledProviderMeta()
  const [activeIndex, setActiveIndex] = useState(0)

  if (providers.length === 0) {
    return (
      <div style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-small)' }}>
        No API key providers are currently enabled.
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
          API Keys
        </h2>
        <p
          style={{
            margin: 'var(--sp-2) 0 0',
            font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
            color: 'var(--fg-3)',
          }}
        >
          Connect your own API keys to run queries on your own quota.
        </p>
      </div>

      <TabBar providers={providers} activeIndex={activeIndex} onSelect={setActiveIndex} />

      {providers.map((p, i) => (
        <div
          key={p.id}
          id={`tab-panel-${p.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${p.id}`}
          hidden={i !== activeIndex}
        >
          {i === activeIndex && <ProviderPanel meta={p} />}
        </div>
      ))}
    </div>
  )
}
