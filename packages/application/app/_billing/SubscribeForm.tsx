'use client'

import { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/app/(authed)/_dashboard/primitives'

interface SubscribeFormProps {
  planLabel: string
  onSuccess: () => void
  onBack: () => void
}

export function SubscribeForm({ planLabel, onSuccess, onBack }: SubscribeFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setSubmitting(false)
    } else {
      onSuccess()
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
        <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={submitting || !stripe}>
          {submitting ? 'Processing…' : `Subscribe to ${planLabel}`}
        </Button>
      </div>
    </form>
  )
}
