import { redirect } from 'next/navigation'

// Any unmatched route in the application redirects to the dashboard Today page
// instead of rendering a 404 error (see issue #356). /dashboard is gated by the
// Clerk middleware (proxy.ts), so unauthenticated users are bounced to sign-in.
export default function NotFound() {
  redirect('/dashboard')
}
