'use client'

import { useState } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '../_auth/AuthShell'
import { AuthCard } from '../_auth/AuthCard'
import { TextField } from '../_auth/TextField'
import { ContinueButton } from '../_auth/ContinueButton'
import { usePasswordStrength } from '../_auth/usePasswordStrength'
import { clerkErrorMessage } from '../_auth/clerkErrors'

type Step = 'email' | 'code' | 'password'

const POST_AUTH_URL = '/dashboard'

export default function ForgotPasswordPage() {
  const { signIn } = useSignIn()
  const router = useRouter()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = usePasswordStrength(password)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !signIn) return
    setLoading(true)
    setError(null)

    const { error: createError } = await signIn.create({ identifier: email })
    if (createError) {
      setError(clerkErrorMessage(createError))
      setLoading(false)
      return
    }

    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode()
    if (sendError) {
      setError(clerkErrorMessage(sendError))
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('code')
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !signIn) return
    setLoading(true)
    setError(null)

    const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code })
    if (verifyError) {
      setError(clerkErrorMessage(verifyError))
      setLoading(false)
      return
    }

    setLoading(false)
    if (signIn.status === 'needs_new_password') {
      setStep('password')
    } else {
      setError('Unexpected sign-in state. Please start over.')
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !signIn) return
    setLoading(true)
    setError(null)

    const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({ password })
    if (submitError) {
      setError(clerkErrorMessage(submitError))
      setLoading(false)
      return
    }

    if (signIn.status === 'complete') {
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
      return
    }

    setError('Password reset could not be completed. Please try again.')
    setLoading(false)
  }

  return (
    <AuthShell>
      <AuthCard>
        <div className="tb-card-body">
          {step === 'email' && (
            <form onSubmit={handleEmail} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Reset your password</h1>
                <p className="tb-subtitle">
                  Enter your email and we&apos;ll send you a code to set a new password.
                </p>
              </header>

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

              <ContinueButton loading={loading} disabled={!email.trim()} label="Send reset code" />

              <p className="tb-footer-link">
                Remembered it?{' '}
                <Link href="/sign-in">Sign in</Link>
              </p>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleCode} className="tb-form">
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
                autoComplete="one-time-code"
                error={error ?? undefined}
              />

              <ContinueButton loading={loading} disabled={!code.trim()} label="Verify code" />

              <button
                type="button"
                className="tb-back"
                onClick={() => { setStep('email'); setCode(''); setError(null) }}
              >
                ← Back
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleNewPassword} className="tb-form">
              <header className="tb-form-head">
                <h1 className="tb-title">Set a new password</h1>
                <p className="tb-subtitle">Choose something strong you&apos;ll remember.</p>
              </header>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <TextField
                  label="New password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="Create a password"
                  onTogglePassword={() => setShowPw((s) => !s)}
                  passwordVisible={showPw}
                  autoComplete="new-password"
                  autoFocus
                  error={error ?? undefined}
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

              <ContinueButton loading={loading} success={success} disabled={!password} label="Update password" />
            </form>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  )
}
