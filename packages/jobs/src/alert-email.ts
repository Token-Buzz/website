/**
 * Sends an email notification to a user when one of their alert rules fires.
 * Mirrors the pattern in key-errors.ts: resolves the user's primary email via
 * the Clerk REST API, then sends via Resend. Never throws — all errors are
 * logged and swallowed.
 */

/**
 * Builds the absolute URL for the alert link.
 * If `link` is a relative path (starts with '/'), prefixes it with
 * `https://app.${webDomain}`. Otherwise returns `link` unchanged.
 * Exported so it can be unit-tested without network I/O.
 */
export function buildAlertUrl(link: string, webDomain: string | undefined): string {
  if (link.startsWith('/')) {
    return `https://app.${webDomain ?? 'tokenbuzz.app'}${link}`
  }
  return link
}

/**
 * Builds the plain-text subject line for an alert email.
 * Exported for unit testing.
 */
export function buildAlertSubject(symbol: string): string {
  return `TokenBuzz alert: ${symbol}`
}

export async function sendAlertEmail(
  params: {
    userId: string
    symbol: string
    message: string
    link: string
  },
  emailCache?: Map<string, string | null>,
): Promise<void> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) {
    console.error('sendAlertEmail: CLERK_SECRET_KEY not set; skipping email')
    return
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.CONTACT_FROM_ADDRESS
  if (!resendApiKey || !fromAddress) {
    console.error('sendAlertEmail: RESEND_API_KEY or CONTACT_FROM_ADDRESS not set; skipping email')
    return
  }

  // Resolve email, using the cache if provided.
  let email: string | null | undefined = emailCache?.get(params.userId)
  if (email === undefined) {
    // Not yet cached — look up via Clerk.
    try {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${params.userId}`, {
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      })
      if (!clerkRes.ok) {
        console.error(`sendAlertEmail: Clerk returned ${clerkRes.status} for user ${params.userId}`)
        emailCache?.set(params.userId, null)
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
      console.error('sendAlertEmail: Clerk fetch failed', err)
      emailCache?.set(params.userId, null)
      return
    }
    emailCache?.set(params.userId, email)
  }

  if (!email) {
    console.error(`sendAlertEmail: no email found for user ${params.userId}`)
    return
  }

  const webDomain = process.env.WEB_DOMAIN
  const alertUrl = buildAlertUrl(params.link, webDomain)

  const html = `
<p>Hi,</p>
<p>One of your TokenBuzz alert rules for <strong>${params.symbol}</strong> just fired:</p>
<p><em>${params.message}</em></p>
<p>View the details: <a href="${alertUrl}">${alertUrl}</a></p>
<p>You can manage your alert rules at <a href="https://app.${webDomain ?? 'tokenbuzz.app'}/alerts">https://app.${webDomain ?? 'tokenbuzz.app'}/alerts</a>.</p>
<p>To stop receiving these emails, turn off email alerts in your <a href="https://app.${webDomain ?? 'tokenbuzz.app'}/account/notifications">account settings</a>.</p>
<p>— The TokenBuzz team</p>
`.trim()

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
        subject: buildAlertSubject(params.symbol),
        html,
      }),
    })
    if (!resendRes.ok) {
      const body = await resendRes.text().catch(() => '(unreadable)')
      console.error(`sendAlertEmail: Resend returned ${resendRes.status}: ${body}`)
    }
  } catch (err) {
    console.error('sendAlertEmail: Resend fetch failed', err)
  }
}
