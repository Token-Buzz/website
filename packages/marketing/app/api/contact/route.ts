import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const params = new URLSearchParams({
    secret:   process.env.TURNSTILE_SECRET!,
    response: token,
  })
  if (ip) params.set('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  })
  const json = (await res.json()) as { success: boolean }
  return json.success === true
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, subject, message, turnstileToken } = body as Record<string, unknown>

  // All fields must be strings
  if (
    typeof name           !== 'string' ||
    typeof email          !== 'string' ||
    typeof subject        !== 'string' ||
    typeof message        !== 'string' ||
    typeof turnstileToken !== 'string'
  ) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  // Presence check
  if (!name.trim() || !email.trim() || !subject.trim() || !message.trim() || !turnstileToken) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  // Length limits
  if (name.length > 100) {
    return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
  }
  if (email.length > 254) {
    return NextResponse.json({ error: 'Email must be 254 characters or fewer' }, { status: 400 })
  }
  if (subject.length > 200) {
    return NextResponse.json({ error: 'Subject must be 200 characters or fewer' }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message must be 5,000 characters or fewer' }, { status: 400 })
  }

  // Email format
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  // Turnstile — prefer Cloudflare's connecting IP header, fall back to X-Forwarded-For
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    null

  let turnstileValid: boolean
  try {
    turnstileValid = await verifyTurnstile(turnstileToken, ip)
  } catch {
    return NextResponse.json(
      { error: 'Bot verification check failed. Please try again.' },
      { status: 503 },
    )
  }

  if (!turnstileValid) {
    return NextResponse.json(
      { error: 'Bot verification failed. Please refresh and try again.' },
      { status: 400 },
    )
  }

  // Sanitize inputs for HTML email templates
  const safeName    = escapeHtml(name.trim())
  const safeEmail   = escapeHtml(email.trim())
  const safeSubject = escapeHtml(subject.trim())
  const safeMessage = escapeHtml(message.trim()).replace(/\r?\n/g, '<br />')

  // Notification → site owner (replyTo routes replies directly to the sender)
  const { error: notifyError } = await resend.emails.send({
    from:    process.env.CONTACT_FROM_ADDRESS!,
    to:      process.env.CONTACT_TO_ADDRESS!,
    replyTo: email.trim(),
    subject: `[Contact] ${subject.trim()}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="margin:0 0 16px">New contact form submission</h2>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:80px;border:1px solid #e5e5e5">Name</td>
            <td style="padding:8px 12px;border:1px solid #e5e5e5">${safeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Email</td>
            <td style="padding:8px 12px;border:1px solid #e5e5e5"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Subject</td>
            <td style="padding:8px 12px;border:1px solid #e5e5e5">${safeSubject}</td>
          </tr>
        </table>
        <h3 style="margin:0 0 8px">Message</h3>
        <p style="line-height:1.6;margin:0">${safeMessage}</p>
      </div>
    `,
  })

  if (notifyError) {
    console.error('Failed to send notification email:', notifyError)
    return NextResponse.json(
      { error: 'Failed to send your message. Please try again later.' },
      { status: 500 },
    )
  }

  // Auto-reply → sender (non-fatal if it fails)
  const { error: replyError } = await resend.emails.send({
    from:    process.env.CONTACT_FROM_ADDRESS!,
    to:      email.trim(),
    replyTo: process.env.CONTACT_TO_ADDRESS!,
    subject: 'Thanks for reaching out — TokenBuzz',
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <p>Hi ${safeName},</p>
        <p>Thanks for getting in touch. We've received your message and will get back to you as soon as possible.</p>
        <p style="color:#888">Here's a copy of what you sent:</p>
        <blockquote style="border-left:3px solid #FF6B2C;margin:0;padding:12px 16px;background:#fafafa;border-radius:0 4px 4px 0">
          <strong>${safeSubject}</strong><br /><br />
          <span style="color:#333">${safeMessage}</span>
        </blockquote>
        <p style="margin-top:24px;color:#666">— The TokenBuzz Team</p>
      </div>
    `,
  })

  if (replyError) {
    console.error('Failed to send auto-reply:', replyError)
  }

  return NextResponse.json({ success: true })
}
