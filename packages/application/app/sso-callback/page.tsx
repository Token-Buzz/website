import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { postAuthDest } from '../_auth/postAuthDest'
import { safeRedirectPath } from '../_auth/redirectDest'

export default async function SsoCallback({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirect_url?: string }>
}) {
  const { token, redirect_url } = await searchParams
  // A `redirect_url` (from a Clerk-gated deep link) wins over the token-based
  // watchlist focus destination.
  const dest = safeRedirectPath(redirect_url) ?? postAuthDest(token ?? null)
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={dest}
      signUpForceRedirectUrl={dest}
    />
  )
}
