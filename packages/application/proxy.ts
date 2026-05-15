import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/account(.*)'])

const isProd = process.env.NODE_ENV === 'production'

const publishableKey = isProd
  ? process.env.NEXT_PUBLIC_PROD_CLERK_PUBLISHABLE_KEY
  : process.env.NEXT_PUBLIC_DEV_CLERK_PUBLISHABLE_KEY

const secretKey = isProd
  ? process.env.PROD_CLERK_SECRET_KEY
  : process.env.DEV_CLERK_SECRET_KEY

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
  },
  { publishableKey, secretKey },
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|gif|png|svg|ico|woff2?|ttf|webp|avif|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
