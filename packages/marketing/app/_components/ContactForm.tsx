'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Button from './Button'

// ── Cloudflare Turnstile — explicit render mode ───────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        params: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ): string
      reset(widgetId: string): void
      remove(widgetId: string): void
    }
  }
}

function TurnstileWidget({
  siteKey,
  onSuccess,
  onExpire,
}: {
  siteKey: string
  onSuccess: (token: string) => void
  onExpire: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef  = useRef<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function renderWidget() {
      if (!container || widgetIdRef.current !== null || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey:            siteKey,
        callback:           onSuccess,
        'expired-callback': onExpire,
        theme:              'dark',
      })
    }

    const SCRIPT_ID = 'cf-turnstile-script'
    const existing  = document.getElementById(SCRIPT_ID)

    if (!existing) {
      const script  = document.createElement('script')
      script.id     = SCRIPT_ID
      script.src    = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async  = true
      script.defer  = true
      script.onload = renderWidget
      document.head.appendChild(script)
    } else if (window.turnstile) {
      renderWidget()
    } else {
      existing.addEventListener('load', renderWidget, { once: true })
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey, onSuccess, onExpire])

  return <div ref={containerRef} />
}

// ── ContactForm ───────────────────────────────────────────────────────────

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface Fields {
  name: string
  email: string
  subject: string
  message: string
}

const EMPTY: Fields = { name: '', email: '', subject: '', message: '' }

const LABEL: React.CSSProperties = {
  display:       'block',
  fontFamily:    'var(--font-mono)',
  fontSize:      11,
  fontWeight:    600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color:         'var(--fg-3)',
  marginBottom:  6,
}

const INPUT: React.CSSProperties = {
  display:      'block',
  width:        '100%',
  background:   'var(--bg-sunken)',
  border:       '1px solid var(--border-strong)',
  borderRadius: 6,
  color:        'var(--fg-1)',
  fontFamily:   'var(--font-sans)',
  fontSize:     14,
  padding:      '10px 12px',
  boxSizing:    'border-box',
}

export default function ContactForm() {
  const [fields,         setFields]         = useState<Fields>(EMPTY)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [status,         setStatus]         = useState<Status>('idle')
  const [errorMsg,       setErrorMsg]       = useState('')
  const submitting = useRef(false)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFields(prev => ({ ...prev, [name]: value }))
  }

  const onTurnstileSuccess = useCallback((token: string) => setTurnstileToken(token), [])
  const onTurnstileExpire  = useCallback(() => setTurnstileToken(null), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current) return

    if (!turnstileToken) {
      setErrorMsg('Please complete the bot verification.')
      return
    }

    submitting.current = true
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res  = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...fields, turnstileToken }),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      } else {
        setStatus('success')
        setFields(EMPTY)
        setTurnstileToken(null)
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStatus('error')
    } finally {
      submitting.current = false
    }
  }

  if (status === 'success') {
    return (
      <div
        style={{
          padding:      '48px 32px',
          textAlign:    'center',
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         'var(--pos)',
            marginBottom:  12,
          }}
        >
          ✓ Message sent
        </div>
        <p
          style={{
            font:         '400 17px/1.55 var(--font-sans)',
            color:        'var(--fg-2)',
            marginBottom: 24,
            marginTop:    0,
          }}
        >
          Thanks for reaching out. We&apos;ll get back to you shortly — check your inbox for a copy.
        </p>
        <Button variant="ghost" onClick={() => setStatus('idle')}>
          Send another message
        </Button>
      </div>
    )
  }

  const isSubmitting = status === 'submitting'

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Name + Email */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap:                 16,
          marginBottom:        16,
        }}
      >
        <div>
          <label htmlFor="contact-name" style={LABEL}>Name</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            value={fields.name}
            onChange={handleChange}
            maxLength={100}
            required
            autoComplete="name"
            disabled={isSubmitting}
            style={INPUT}
          />
        </div>
        <div>
          <label htmlFor="contact-email" style={LABEL}>Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            value={fields.email}
            onChange={handleChange}
            maxLength={254}
            required
            autoComplete="email"
            disabled={isSubmitting}
            style={INPUT}
          />
        </div>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-subject" style={LABEL}>Subject</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          value={fields.subject}
          onChange={handleChange}
          maxLength={200}
          required
          disabled={isSubmitting}
          style={INPUT}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="contact-message" style={LABEL}>Message</label>
        <textarea
          id="contact-message"
          name="message"
          value={fields.message}
          onChange={handleChange}
          maxLength={5000}
          required
          rows={6}
          disabled={isSubmitting}
          style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }}
        />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   11,
            color:      'var(--fg-4)',
            marginTop:  4,
            textAlign:  'right',
          }}
        >
          {fields.message.length} / 5,000
        </div>
      </div>

      {/* Turnstile */}
      <div style={{ marginBottom: 20 }}>
        <TurnstileWidget
          siteKey={siteKey}
          onSuccess={onTurnstileSuccess}
          onExpire={onTurnstileExpire}
        />
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div
          style={{
            fontFamily:   'var(--font-mono)',
            fontSize:     12,
            color:        'var(--neg)',
            background:   'rgba(224,102,78,0.08)',
            border:       '1px solid rgba(224,102,78,0.25)',
            borderRadius: 6,
            padding:      '8px 12px',
            marginBottom: 16,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Submit — native type="submit" so Enter and form submission work */}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width:          '100%',
          fontFamily:     'var(--font-sans)',
          fontWeight:     600,
          fontSize:       16,
          letterSpacing:  '-0.005em',
          lineHeight:     1,
          padding:        '14px 22px',
          borderRadius:   8,
          border:         '1px solid transparent',
          cursor:         isSubmitting ? 'wait' : 'pointer',
          background:     isSubmitting ? 'var(--ink-700)' : 'var(--buzz-500)',
          color:          '#fff',
          opacity:        isSubmitting ? 0.7 : 1,
          transition:     'all 160ms var(--ease-out)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        {isSubmitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
