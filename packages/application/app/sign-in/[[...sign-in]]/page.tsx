'use client'

import { useState, useEffect } from 'react'
import { useSignIn, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '../../_auth/AuthShell'
import { AuthCard } from '../../_auth/AuthCard'
import { ModeTabs } from '../../_auth/ModeTabs'
import { ProviderButton } from '../../_auth/ProviderButton'
import { OrDivider } from '../../_auth/OrDivider'
import { TextField } from '../../_auth/TextField'
import { ContinueButton } from '../../_auth/ContinueButton'
import { clerkErrorMessage } from '../../_auth/clerkErrors'
import { AuthLoading } from '../../_auth/AuthLoading'

const SSO_CALLBACK_URL = '/sso-callback'
const POST_AUTH_URL = '/dashboard'

type OAuthStrategy = 'oauth_google' | 'oauth_github' | 'oauth_microsoft'
type Step = 'form' | 'mfa'

export default function SignInPage() {
  const { signIn } = useSignIn()
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(POST_AUTH_URL)
  }, [isLoaded, isSignedIn, router])

  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [mfaEmail, setMfaEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clerkUnavailable, setClerkUnavailable] = useState(false)

  useEffect(() => {
    if (isLoaded) return
    const timer = setTimeout(() => setClerkUnavailable(true), 10_000)
    return () => clearTimeout(timer)
  }, [isLoaded])

  async function finalize() {
    if (!signIn) return
    setSuccess(true)
    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return
        const url = decorateUrl(POST_AUTH_URL)
        if (url.startsWith('http')) {
          window.location.href = url
        } else {
          router.push(url)
        }
      },
    })
    if (finalizeError) {
      setError(clerkErrorMessage(finalizeError))
      setSuccess(false)
      setLoading(false)
    }
  }

  async function sendMfaEmailCode() {
    if (!signIn) return
    const { error: sendError } = await signIn.mfa.sendEmailCode()
    if (sendError) {
      setError(clerkErrorMessage(sendError))
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (!signIn) {
      setError('Authentication service is unavailable. Please refresh and try again.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: pwError } = await signIn.password({
      emailAddress: email,
      password,
    })

    if (pwError) {
      setError(clerkErrorMessage(pwError))
      setLoading(false)
      return
    }

    if (signIn.status === 'complete') {
      await finalize()
      return
    }

    if (signIn.status === 'needs_second_factor') {
      const emailFactor = signIn.supportedSecondFactors.find(
        (f) => f.strategy === 'email_code'
      )
      setMfaEmail(
        (emailFactor as { safeIdentifier?: string } | undefined)?.safeIdentifier ?? email
      )
      await sendMfaEmailCode()
      setLoading(false)
      setStep('mfa')
      return
    }

    setError('Sign-in could not be completed. Please try again.')
    setLoading(false)
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !signIn) return
    setLoading(true)
    setError(null)

    const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code })

    if (verifyError) {
      setError(clerkErrorMessage(verifyError))
      setLoading(false)
      return
    }

    if (signIn.status === 'complete') {
      await finalize()
      return
    }

    setError('Verification could not be completed. Please try again.')
    setLoading(false)
  }

  async function handleResend() {
    if (!signIn) return
    setError(null)
    setCode('')
    await sendMfaEmailCode()
  }

  async function handleOAuth(strategy: OAuthStrategy) {
    if (!signIn) {
      setError('Authentication service is unavailable. Please refresh and try again.')
      return
    }
    setError(null)
    const { error: ssoError } = await signIn.sso({
      strategy,
      redirectUrl: POST_AUTH_URL,
      redirectCallbackUrl: SSO_CALLBACK_URL,
    })
    if (ssoError) setError(clerkErrorMessage(ssoError))
  }

  if (clerkUnavailable && !isLoaded) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="tb-card-body">
            <div className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Service Unavailable</h1>
                <p className="tb-subtitle">
                  We&apos;re having trouble connecting to our authentication service. Please refresh the page or try again later.
                </p>
              </header>
              <button className="tb-continue" type="button" onClick={() => window.location.reload()}>
                Refresh page
              </button>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    )
  }

  if (!isLoaded) return <AuthLoading message="Loading…" />
  if (isSignedIn) return <AuthLoading message="Taking you to your dashboard…" />

  return (
    <AuthShell>
      <AuthCard>
        <ModeTabs mode="in" />
        <div className="tb-card-body">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Sign in to TokenBuzz</h1>
                <p className="tb-subtitle">Welcome back. Pick up where you left off.</p>
              </header>

              <div className="tb-providers">
                <ProviderButton provider="google" onClick={() => handleOAuth('oauth_google')} disabled={loading} />
                <ProviderButton provider="github" onClick={() => handleOAuth('oauth_github')} disabled={loading} />
                <ProviderButton provider="microsoft" onClick={() => handleOAuth('oauth_microsoft')} disabled={loading} />
              </div>

              <OrDivider />

              <TextField
                label="Email address"
                badge="Last used"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@domain.com"
                autoFocus
                autoComplete="email"
              />

              <TextField
                label="Password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                onTogglePassword={() => setShowPw((s) => !s)}
                passwordVisible={showPw}
                autoComplete="current-password"
                error={error ?? undefined}
              />

              <p className="tb-forgot">
                <Link href="/forgot-password">Forgot password?</Link>
              </p>

              <div id="clerk-captcha" />

              <ContinueButton loading={loading} success={success} disabled={!email.trim() || !password} />

              <p className="tb-footer-link">
                Don&apos;t have an account?{' '}
                <Link href="/sign-up">Sign up</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Check your email</h1>
                <p className="tb-subtitle">
                  We sent a 6-digit code to{' '}
                  <strong style={{ color: 'var(--fg-1)' }}>{mfaEmail}</strong>
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

              <ContinueButton loading={loading} success={success} disabled={!code.trim()} label="Verify" />

              <p className="tb-footer-link">
                Didn&apos;t get a code?{' '}
                <button type="button" onClick={handleResend}>
                  Resend code
                </button>
              </p>

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
