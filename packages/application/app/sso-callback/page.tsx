import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { postAuthDest } from '../_auth/postAuthDest'

export default async function SsoCallback({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const dest = postAuthDest(token ?? null)
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={dest}
      signUpForceRedirectUrl={dest}
    />
  )
}
