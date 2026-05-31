'use client'

import { useState, useEffect } from 'react'
import { useSignUp, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '../../_auth/AuthShell'
import { AuthCard } from '../../_auth/AuthCard'
import { ModeTabs } from '../../_auth/ModeTabs'
import { ProviderButton } from '../../_auth/ProviderButton'
import { OrDivider } from '../../_auth/OrDivider'
import { TextField } from '../../_auth/TextField'
import { ContinueButton } from '../../_auth/ContinueButton'
import { usePasswordStrength } from '../../_auth/usePasswordStrength'
import { clerkErrorMessage } from '../../_auth/clerkErrors'
import { postAuthDest } from '../../_auth/postAuthDest'
import { safeRedirectPath } from '../../_auth/redirectDest'
import { AuthLoading } from '../../_auth/AuthLoading'

type Step = 'form' | 'code'

const SSO_CALLBACK_URL = '/sso-callback'

function destFromUrl() {
  const params = new URLSearchParams(window.location.search)
  // A `redirect_url` (from a Clerk-gated deep link, e.g. the pricing cards)
  // takes precedence over the token-based watchlist focus destination.
  const redirect = safeRedirectPath(params.get('redirect_url'))
  if (redirect) return redirect
  return postAuthDest(params.get('token'))
}

export default function SignUpPage() {
  const { signUp } = useSignUp()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  // Preserve the current query string (e.g. redirect_url) when switching to
  // sign-in. Computed after mount to avoid a hydration mismatch.
  const [authQuery, setAuthQuery] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setAuthQuery(window.location.search) }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(destFromUrl())
  }, [isLoaded, isSignedIn, router])

  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = usePasswordStrength(password)

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || !signUp) return
    setLoading(true)
    setError(null)

    const { error: createError } = await signUp.create({ emailAddress: email, password })
    if (createError) {
      setError(clerkErrorMessage(createError))
      setLoading(false)
      return
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode()
    if (sendError) {
      setError(clerkErrorMessage(sendError))
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('code')
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !signUp) return
    setLoading(true)
    setError(null)

    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code })
    if (verifyError) {
      setError(clerkErrorMessage(verifyError))
      setLoading(false)
      return
    }

    if (signUp.status === 'complete') {
      setSuccess(true)
      const { error: finalizeError } = await signUp.finalize()
      if (finalizeError) {
        setError(clerkErrorMessage(finalizeError))
        setSuccess(false)
        setLoading(false)
        return
      }
      router.push(destFromUrl())
    }
    setLoading(false)
  }

  async function handleOAuth(strategy: 'oauth_google' | 'oauth_github' | 'oauth_microsoft') {
    if (!signUp) return
    setError(null)
    const params = new URLSearchParams(window.location.search)
    const passthrough = new URLSearchParams()
    const token = params.get('token')
    if (token) passthrough.set('token', token)
    const redirect = params.get('redirect_url')
    if (redirect) passthrough.set('redirect_url', redirect)
    const qs = passthrough.toString()
    const callback = qs ? `${SSO_CALLBACK_URL}?${qs}` : SSO_CALLBACK_URL
    const { error: ssoError } = await signUp.sso({
      strategy,
      redirectUrl: callback,
      redirectCallbackUrl: callback,
    })
    if (ssoError) setError(clerkErrorMessage(ssoError))
  }

  if (!isLoaded) return <AuthLoading message="Loading…" />
  if (isSignedIn) return <AuthLoading message="Taking you to the app…" />

  return (
    <AuthShell>
      <AuthCard>
        <ModeTabs mode="up" />
        <div className="tb-card-body">
          {step === 'form' ? (
            <form onSubmit={handleFormSubmit} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Create your account</h1>
                <p className="tb-subtitle">Watchlist, alerts, and Hum — yours in 30 seconds.</p>
              </header>

              <div className="tb-providers">
                <ProviderButton provider="google" onClick={() => handleOAuth('oauth_google')} disabled={loading} />
                <ProviderButton provider="github" onClick={() => handleOAuth('oauth_github')} disabled={loading} />
                <ProviderButton provider="microsoft" onClick={() => handleOAuth('oauth_microsoft')} disabled={loading} />
              </div>

              <OrDivider />

              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@domain.com"
                autoFocus
                autoComplete="email"
                error={error ?? undefined}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <TextField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="Create a password"
                  onTogglePassword={() => setShowPw((s) => !s)}
                  passwordVisible={showPw}
                  autoComplete="new-password"
                />

                {strength && (
                  <div className="tb-strength" aria-hidden="true">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`tb-strength-bar${i <= strength.score ? ' is-on' : ''} s-${strength.score}`}
                      />
                    ))}
                    <span className="tb-strength-label">{strength.label}</span>
                  </div>
                )}
              </div>

              <div id="clerk-captcha" />

              <ContinueButton
                loading={loading}
                success={success}
                disabled={!email.trim() || !password}
                label="Create account"
              />

              <p className="tb-footer-link">
                Already have an account?{' '}
                <Link href={`/sign-in${authQuery}`}>Sign in</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Check your email</h1>
                <p className="tb-subtitle">
                  We sent a 6-digit code to{' '}
                  <strong style={{ color: 'var(--fg-1)' }}>{email}</strong>
                </p>
              </header>

              <TextField
                label="Verification code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={setCode}
                placeholder="000000"
                autoFocus
                error={error ?? undefined}
                autoComplete="one-time-code"
              />

              <ContinueButton loading={loading} success={success} disabled={!code.trim()} label="Verify email" />

              <button
                type="button"
                className="tb-back"
                onClick={() => { setStep('form'); setCode(''); setError(null) }}
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  )
}
