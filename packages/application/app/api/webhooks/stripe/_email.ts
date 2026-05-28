/**
 * Sends a downgrade email to a user when their Stripe subscription is deleted
 * after a failed payment. Mirrors the pattern in packages/jobs/src/alert-email.ts.
 * Never throws — all errors are logged and swallowed.
 */

/**
 * Returns the email subject for the downgrade notification.
 * Exported for unit testing.
 */
export function downgradeEmailSubject(): string {
  return 'Your TokenBuzz subscription has ended'
}

/**
 * Builds the HTML body for the downgrade notification email.
 * Exported for unit testing.
 */
export function buildDowngradeEmailHtml(webDomain: string | undefined): string {
  const domain = webDomain ?? 'tokenbuzz.app'
  const accountUrl = `https://app.${domain}/account`
  return `
<p>Hi,</p>
<p>We weren't able to process your payment after several retries, so your TokenBuzz account has been moved to the <strong>Free plan</strong>.</p>
<p>You still have access to all free features. Whenever you're ready, you can re-subscribe at any time:</p>
<p><a href="${accountUrl}">${accountUrl}</a></p>
<p>If you have any questions, feel free to reply to this email.</p>
<p>— The TokenBuzz team</p>
`.trim()
}

export async function sendDowngradeEmail({ userId }: { userId: string }): Promise<void> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) {
    console.error('sendDowngradeEmail: CLERK_SECRET_KEY not set; skipping email')
    return
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.CONTACT_FROM_ADDRESS
  if (!resendApiKey || !fromAddress) {
    console.error('sendDowngradeEmail: RESEND_API_KEY or CONTACT_FROM_ADDRESS not set; skipping email')
    return
  }

  // Resolve user's primary email via Clerk REST API.
  let email: string | null = null
  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    })
    if (!clerkRes.ok) {
      console.error(`sendDowngradeEmail: Clerk returned ${clerkRes.status} for user ${userId}`)
      return
    }
    const clerkUser = (await clerkRes.json()) as {
      primary_email_address_id?: string
      email_addresses?: Array<{ id: string; email_address: string }>
    }
    const emails = clerkUser.email_addresses ?? []
    const primary = emails.find((e) => e.id === clerkUser.primary_email_address_id)
    email = primary?.email_address ?? emails[0]?.email_address ?? null
  } catch (err) {
    console.error('sendDowngradeEmail: Clerk fetch failed', err)
    return
  }

  if (!email) {
    console.error(`sendDowngradeEmail: no email found for user ${userId}`)
    return
  }

  const webDomain = process.env.WEB_DOMAIN
  const html = buildDowngradeEmailHtml(webDomain)

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: downgradeEmailSubject(),
        html,
      }),
    })
    if (!resendRes.ok) {
      const body = await resendRes.text().catch(() => '(unreadable)')
      console.error(`sendDowngradeEmail: Resend returned ${resendRes.status}: ${body}`)
    }
  } catch (err) {
    console.error('sendDowngradeEmail: Resend fetch failed', err)
  }
}
