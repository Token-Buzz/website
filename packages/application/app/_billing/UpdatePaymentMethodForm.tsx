'use client'

import { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/app/(authed)/_dashboard/primitives'

interface UpdatePaymentMethodFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function UpdatePaymentMethodForm({ onSuccess, onCancel }: UpdatePaymentMethodFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Failed to save card.')
      setSubmitting(false)
      return
    }

    // setupIntent is defined when redirect:'if_required' and no redirect occurred
    const paymentMethodId =
      setupIntent && typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : null

    if (!paymentMethodId) {
      setError('Could not confirm card. Please try again.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/billing/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? `Failed to save card (${res.status}).`)
        setSubmitting(false)
        return
      }
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PaymentElement />

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bear-100, rgba(220,53,69,0.1))',
            border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
            borderRadius: 6,
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--bear-500, #dc3545)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={submitting || !stripe}>
          {submitting ? 'Saving…' : 'Save card'}
        </Button>
      </div>
    </form>
  )
}
