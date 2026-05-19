import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/watchlist(.*)', '/analytics(.*)', '/alerts(.*)', '/account(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Server action requests use Next-Action header; skip route protection so that
  // Clerk's own invalidateCacheAction can fire after sign-out even on protected
  // routes (the session cookie is already cleared at that point, so auth.protect()
  // would otherwise block the action and prevent the sign-out from completing).
  if (isProtectedRoute(req) && !req.headers.get('next-action')) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|gif|png|svg|ico|woff2?|ttf|webp|avif|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
